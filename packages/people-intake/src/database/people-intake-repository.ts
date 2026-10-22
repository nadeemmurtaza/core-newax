import type {
  CreatePeopleIntakeRecordInput,
  CreatePeopleIntakeRecordResult,
  ListPeopleIntakesRecordInput,
  ListPeopleIntakesRecordResult,
  PeopleIntakeIdentityInput,
  ReviewPeopleIntakeRecordInput,
  ReviewPeopleIntakeRecordResult,
  StoredPeopleIntakeRecord,
  SubmitPeopleIntakeRecordInput,
  SubmitPeopleIntakeRecordResult,
  UpdatePeopleIntakeRecordInput,
  UpdatePeopleIntakeRecordResult,
} from '../types/people-intake';

export interface PeopleIntakeRepository {
  createDraft(input: CreatePeopleIntakeRecordInput): Promise<CreatePeopleIntakeRecordResult>;
  findById(input: PeopleIntakeIdentityInput): Promise<StoredPeopleIntakeRecord | null>;
  list(input: ListPeopleIntakesRecordInput): Promise<ListPeopleIntakesRecordResult>;
  updateDraft(input: UpdatePeopleIntakeRecordInput): Promise<UpdatePeopleIntakeRecordResult>;
  submit(input: SubmitPeopleIntakeRecordInput): Promise<SubmitPeopleIntakeRecordResult>;
  review(input: ReviewPeopleIntakeRecordInput): Promise<ReviewPeopleIntakeRecordResult>;
}
