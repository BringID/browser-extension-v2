import api from '../../utils/api';
import { TVerify, TVerifyResponse } from './types';
import configs from '../../../configs';

const verify: TVerify = (
  apiUrl,
  presentationData,
  registry,
  credentialGroupId,
  semaphoreIdentityCommitment,
) =>
  api<TVerifyResponse>(
    `${apiUrl}/v1/verifier/base-sepolia/verify `,
    'POST',
    {
      'Authorization': `Bearer ${configs.ZUPLO_KEY}`,
    },
    {
      tlsn_presentation: presentationData,
      registry,
      credential_group_id: credentialGroupId,
      semaphore_identity_commitment: semaphoreIdentityCommitment,
    },
  );

const verifyService = {
  verify,
};

export default verifyService;
