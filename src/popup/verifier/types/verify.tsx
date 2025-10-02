import TVerifyResult from '../../types/verify-result';

type TVerify = (
  presentationData: string,
  credentialGroupId: string,
  semaphoreIdentityCommitment: string,
) => Promise<TVerifyResult | void>;

export default TVerify;
