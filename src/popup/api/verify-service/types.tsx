type TVerifyResponse = {
  verifier_hash: string;
  signature: string;
  verifier_message: {
    registry: string;
    credential_group_id: string;
    id_hash: string;
    semaphore_identity_commitment: string;
  };
};

type TVerify = (
  apiUrl: string,
  presentationData: string,
  registry: string,
  credentialGroupId: string,
  semaphoreIdentityCommitment: string,
) => Promise<TVerifyResponse>;

export { TVerify, TVerifyResponse };
