import api from '../../utils/api';
import {
  TAddVerification,
  TAddVerificationResponse,
  TGetVerification,
  TGetVerificationResponse,
} from './types';
import configs from '../../../configs';

const addVerification: TAddVerification = (
  apiUrl,
  registry,
  credentialGroupId,
  idHash,
  identityCommitment,
  verifierSignature,
) =>
  api<TAddVerificationResponse>(
    `${apiUrl}/v1/task-manager/base-sepolia/verification/tasks`,
    'POST',
    {
      'Authorization': `Bearer ${configs.ZUPLO_KEY}`,
    },
    {
      registry: registry,
      credential_group_id: credentialGroupId,
      id_hash: idHash,
      identity_commitment: identityCommitment,
      verifier_signature: verifierSignature,
    },
  );

const getVerification: TGetVerification = (taskId) =>
  api<TGetVerificationResponse>(
    `${configs.ZUPLO_API_URL}/v1/task-manager/base-sepolia/verification/tasks/${taskId}`,
    'GET',
    {
      'Authorization': `Bearer ${configs.ZUPLO_KEY}`,
    }
  );

const taskManager = {
  addVerification,
  getVerification,
};

export default taskManager;
