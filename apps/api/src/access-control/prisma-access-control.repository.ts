import { Inject, Injectable } from '@nestjs/common';
import type {
  AccessControlRepository,
  AssignMembershipRoleRecordInput,
  AssignMembershipRoleResult,
  AssignmentListQuery,
  AssignmentPage,
  CreateRoleFromTemplateRecordInput,
  CreateRoleRecordInput,
  CreateRoleResult,
  MembershipRoleAssignmentRecord,
  PermissionEvaluation,
  PermissionListQuery,
  PermissionPage,
  PermissionRecord,
  PermissionRegistrationResult,
  RegisterPermissionRecordInput,
  RoleListQuery,
  RolePage,
  RolePermissionRecord,
  RoleRecord,
  RoleStatus,
  RoleType,
  UpdateRoleRecordInput,
} from '@newax/access-control';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';

interface RoleDatabaseRecord {
  readonly id: string;
  readonly organizationId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly roleType: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface PermissionDatabaseRecord {
  readonly id: string;
  readonly code: string;
  readonly moduleCode: string;
  readonly resource: string;
  readonly action: string;
  readonly riskLevel: string;
  readonly description: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

interface RolePermissionDatabaseRecord {
  readonly roleId: string;
  readonly permissionId: string;
  readonly effect: string;
  readonly createdByUserId: string | null;
  readonly createdAt: Date;
}

interface AssignmentDatabaseRecord {
  readonly id: string;
  readonly membershipId: string;
  readonly roleId: string;
  readonly assignedByUserId: string | null;
  readonly revokedByUserId: string | null;
  readonly validFrom: Date;
  readonly validUntil: Date | null;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

@Injectable()
export class PrismaAccessControlRepository implements AccessControlRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async archiveRole(id: string): Promise<RoleRecord> {
    const record = await this.prisma.coreRole.update({
      where: { id },
      data: { status: 'archived' },
    });
    return this.mapRole(record);
  }

  async assignMembershipRole(
    input: AssignMembershipRoleRecordInput,
  ): Promise<AssignMembershipRoleResult> {
    const lockKey = `${input.membershipId}|${input.roleId}`;
    const now = new Date();

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<AssignMembershipRoleResult> => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;

        const existing = await transaction.coreMembershipRole.findFirst({
          where: {
            membershipId: input.membershipId,
            roleId: input.roleId,
            revokedAt: null,
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
          },
          select: { id: true },
        });

        if (existing !== null) {
          return {
            status: 'conflict',
            existingAssignmentId: existing.id,
          };
        }

        const record = await transaction.coreMembershipRole.create({
          data: {
            membershipId: input.membershipId,
            roleId: input.roleId,
            assignedByUserId: input.assignedByUserId,
            validFrom: input.validFrom,
            validUntil: input.validUntil,
          },
        });

        return {
          status: 'assigned',
          assignment: this.mapAssignment(record),
        };
      },
    );
  }

  async createRole(input: CreateRoleRecordInput): Promise<CreateRoleResult> {
    return this.createRoleTransaction(input, null);
  }

  async createRoleFromTemplate(
    input: CreateRoleFromTemplateRecordInput,
  ): Promise<CreateRoleResult> {
    return this.createRoleTransaction(input, input.templateRoleId);
  }

  async evaluateMembershipPermissions(
    membershipId: string,
    organizationId: string,
    evaluatedAt: Date,
  ): Promise<PermissionEvaluation> {
    const assignments = await this.prisma.coreMembershipRole.findMany({
      where: {
        membershipId,
        revokedAt: null,
        validFrom: { lte: evaluatedAt },
        OR: [{ validUntil: null }, { validUntil: { gt: evaluatedAt } }],
        role: {
          organizationId,
          roleType: 'organization',
          status: 'active',
        },
      },
      select: {
        role: {
          select: {
            rolePermissions: {
              where: { permission: { status: 'active' } },
              select: {
                effect: true,
                permission: { select: { code: true } },
              },
            },
          },
        },
      },
    });

    const allowed = new Set<string>();
    const denied = new Set<string>();

    for (const assignment of assignments) {
      for (const rolePermission of assignment.role.rolePermissions) {
        if (rolePermission.effect === 'deny') {
          denied.add(rolePermission.permission.code);
        } else if (rolePermission.effect === 'allow') {
          allowed.add(rolePermission.permission.code);
        }
      }
    }

    const allowedPermissionCodes = [...allowed].sort();
    const deniedPermissionCodes = [...denied].sort();
    const effectivePermissionCodes = allowedPermissionCodes.filter((code) => !denied.has(code));

    return {
      membershipId,
      organizationId,
      evaluatedAt: new Date(evaluatedAt.getTime()),
      allowedPermissionCodes,
      deniedPermissionCodes,
      effectivePermissionCodes,
    };
  }

  async findAssignmentById(id: string): Promise<MembershipRoleAssignmentRecord | null> {
    const record = await this.prisma.coreMembershipRole.findUnique({ where: { id } });
    return record === null ? null : this.mapAssignment(record);
  }

  async findPermissionById(id: string): Promise<PermissionRecord | null> {
    const record = await this.prisma.corePermission.findUnique({ where: { id } });
    return record === null ? null : this.mapPermission(record);
  }

  async findRoleById(id: string): Promise<RoleRecord | null> {
    const record = await this.prisma.coreRole.findUnique({ where: { id } });
    return record === null ? null : this.mapRole(record);
  }

  async listAssignments(
    organizationId: string,
    query: AssignmentListQuery,
  ): Promise<AssignmentPage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CoreMembershipRoleWhereInput = {
      membership: { organizationId },
    };

    if (query.membershipId !== undefined) {
      where.membershipId = query.membershipId;
    }
    if (query.roleId !== undefined) {
      where.roleId = query.roleId;
    }
    if (query.includeRevoked !== true) {
      where.revokedAt = null;
    }

    const records = await this.prisma.coreMembershipRole.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });

    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const last = page.at(-1);
    return {
      items: page.map((record) => this.mapAssignment(record)),
      nextCursor: hasMore && last !== undefined ? last.id : null,
    };
  }

  async listPermissions(query: PermissionListQuery): Promise<PermissionPage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CorePermissionWhereInput = {};
    if (query.moduleCode !== undefined) {
      where.moduleCode = query.moduleCode;
    }
    where.status = query.status ?? 'active';
    if (query.search !== undefined) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { resource: { contains: query.search, mode: 'insensitive' } },
        { action: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const records = await this.prisma.corePermission.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const last = page.at(-1);
    return {
      items: page.map((record) => this.mapPermission(record)),
      nextCursor: hasMore && last !== undefined ? last.id : null,
    };
  }

  async listRolePermissions(roleId: string): Promise<readonly RolePermissionRecord[]> {
    const records = await this.prisma.coreRolePermission.findMany({
      where: { roleId },
      orderBy: { permissionId: 'asc' },
    });
    return records.map((record) => this.mapRolePermission(record));
  }

  async listRoles(organizationId: string | null, query: RoleListQuery): Promise<RolePage> {
    const limit = query.limit ?? 50;
    const where: Prisma.CoreRoleWhereInput = {};

    if (query.roleType === 'organization') {
      where.organizationId = organizationId;
      where.roleType = 'organization';
    } else if (query.roleType === 'template' || query.roleType === 'system') {
      where.organizationId = null;
      where.roleType = query.roleType;
    } else {
      where.OR = [
        { organizationId, roleType: 'organization' },
        { organizationId: null, roleType: { in: ['template', 'system'] } },
      ];
    }

    where.status = query.status ?? 'active';
    if (query.search !== undefined) {
      where.AND = [
        {
          OR: [
            { code: { contains: query.search, mode: 'insensitive' } },
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const records = await this.prisma.coreRole.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
      ...(query.afterId === undefined ? {} : { cursor: { id: query.afterId }, skip: 1 }),
    });
    const hasMore = records.length > limit;
    const page = hasMore ? records.slice(0, limit) : records;
    const last = page.at(-1);
    return {
      items: page.map((record) => this.mapRole(record)),
      nextCursor: hasMore && last !== undefined ? last.id : null,
    };
  }

  async registerPermission(
    input: RegisterPermissionRecordInput,
  ): Promise<PermissionRegistrationResult> {
    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<PermissionRegistrationResult> => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${input.code}, 0))
        `;
        const existing = await transaction.corePermission.findUnique({
          where: { code: input.code },
        });

        if (existing === null) {
          const created = await transaction.corePermission.create({ data: input });
          return { status: 'registered', permission: this.mapPermission(created) };
        }

        const updated = await transaction.corePermission.update({
          where: { id: existing.id },
          data: {
            moduleCode: input.moduleCode,
            resource: input.resource,
            action: input.action,
            riskLevel: input.riskLevel,
            description: input.description,
            status: 'active',
          },
        });
        return { status: 'updated', permission: this.mapPermission(updated) };
      },
    );
  }

  async removeRolePermission(roleId: string, permissionId: string): Promise<boolean> {
    const result = await this.prisma.coreRolePermission.deleteMany({
      where: { roleId, permissionId },
    });
    return result.count > 0;
  }

  async revokeAssignment(
    id: string,
    revokedByUserId: string,
    revokedAt: Date,
  ): Promise<MembershipRoleAssignmentRecord> {
    const record = await this.prisma.coreMembershipRole.update({
      where: { id },
      data: { revokedByUserId, revokedAt },
    });
    return this.mapAssignment(record);
  }

  async setRolePermission(
    roleId: string,
    permissionId: string,
    effect: 'allow' | 'deny',
    createdByUserId: string,
  ): Promise<RolePermissionRecord> {
    const record = await this.prisma.coreRolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      create: { roleId, permissionId, effect, createdByUserId },
      update: { effect, createdByUserId },
    });
    return this.mapRolePermission(record);
  }

  async updateRole(id: string, input: UpdateRoleRecordInput): Promise<RoleRecord> {
    const data: Prisma.CoreRoleUncheckedUpdateInput = {};
    if (input.name !== undefined) {
      data.name = input.name;
    }
    if ('description' in input) {
      data.description = input.description ?? null;
    }
    const record = await this.prisma.coreRole.update({ where: { id }, data });
    return this.mapRole(record);
  }

  private async createRoleTransaction(
    input: CreateRoleRecordInput,
    templateRoleId: string | null,
  ): Promise<CreateRoleResult> {
    const scope = input.organizationId ?? `global:${input.roleType}`;
    const lockKey = `${scope}|${input.code}`;

    return this.prisma.$transaction(
      async (transaction: Prisma.TransactionClient): Promise<CreateRoleResult> => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        `;
        const existing = await transaction.coreRole.findFirst({
          where: {
            organizationId: input.organizationId,
            roleType: input.roleType,
            code: input.code,
          },
          select: { id: true },
        });
        if (existing !== null) {
          return { status: 'conflict', existingRoleId: existing.id };
        }

        const role = await transaction.coreRole.create({ data: input });
        if (templateRoleId !== null) {
          const templatePermissions = await transaction.coreRolePermission.findMany({
            where: { roleId: templateRoleId },
            select: { permissionId: true, effect: true },
          });
          if (templatePermissions.length > 0) {
            await transaction.coreRolePermission.createMany({
              data: templatePermissions.map((permission) => ({
                roleId: role.id,
                permissionId: permission.permissionId,
                effect: permission.effect,
              })),
            });
          }
        }
        return { status: 'created', role: this.mapRole(role) };
      },
    );
  }

  private mapRole(record: RoleDatabaseRecord): RoleRecord {
    return {
      ...record,
      roleType: this.mapRoleType(record.roleType),
      status: this.mapRoleStatus(record.status),
    };
  }

  private mapPermission(record: PermissionDatabaseRecord): PermissionRecord {
    if (record.status !== 'active' && record.status !== 'archived') {
      throw new Error(`Unsupported permission status: ${record.status}`);
    }
    return { ...record, status: record.status };
  }

  private mapRolePermission(record: RolePermissionDatabaseRecord): RolePermissionRecord {
    if (record.effect !== 'allow' && record.effect !== 'deny') {
      throw new Error(`Unsupported permission effect: ${record.effect}`);
    }
    return { ...record, effect: record.effect };
  }

  private mapAssignment(record: AssignmentDatabaseRecord): MembershipRoleAssignmentRecord {
    return { ...record };
  }

  private mapRoleType(value: string): RoleType {
    if (value === 'system' || value === 'template' || value === 'organization') {
      return value;
    }
    throw new Error(`Unsupported role type: ${value}`);
  }

  private mapRoleStatus(value: string): RoleStatus {
    if (value === 'active' || value === 'archived') {
      return value;
    }
    throw new Error(`Unsupported role status: ${value}`);
  }
}
