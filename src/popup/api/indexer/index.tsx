import configs from '../../../configs';
import api from '../../utils/api';
import { TGetProof, TGetProofResponse } from './types';

const getProof: TGetProof = (apiUrl, identityCommitment, semaphoreGroupId) =>
  api<TGetProofResponse>(
    `${apiUrl}/v1/indexer/base-sepolia/proofs?identity_commitment=${identityCommitment}&semaphore_group_id=${semaphoreGroupId}`,
    'GET',
    {
      'Authorization': `Bearer ${configs.ZUPLO_KEY}`,
    },
  );

const indexer = {
  getProof,
};

export default indexer;
