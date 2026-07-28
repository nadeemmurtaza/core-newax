import type {
  ListOrganizationFilesRecordInput,
  ListOrganizationFilesResult,
  RegisterOrganizationFileRecordInput,
  RegisterOrganizationFileResult,
} from '../types/file';

export interface FileRepository {
  registerOrganizationFile(
    input: RegisterOrganizationFileRecordInput,
  ): Promise<RegisterOrganizationFileResult>;
  listOrganizationFiles(
    input: ListOrganizationFilesRecordInput,
  ): Promise<ListOrganizationFilesResult>;
}
