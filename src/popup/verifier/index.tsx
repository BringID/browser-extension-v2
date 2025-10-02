import IVerifier, { TVerify } from './types';
import verifierApi from '../api/verify-service';
import config from '../../configs';
import { defineApiUrl } from '../../common/utils';

class Verifier implements IVerifier {
  #apiUrl: string;

  constructor() {
    this.#apiUrl = defineApiUrl()
  }

  verify: TVerify = async (
    presentationData,
    credentialGroupId,
    semaphoreIdentityCommitment,
  ) => {
    try {
      const response = await verifierApi.verify(
        this.#apiUrl,
        presentationData,
        config.REGISTRY,
        credentialGroupId,
        semaphoreIdentityCommitment,
      );
      const { verifier_hash, signature, verifier_message } = response;
      if (verifier_hash && signature && verifier_message) {
        const result = {
          verifierHash: verifier_hash,
          signature,
          verifierMessage: {
            registry: verifier_message.registry,
            credentialGroupId: verifier_message.credential_group_id,
            idHash: verifier_message.id_hash,
            identityCommitment: verifier_message.semaphore_identity_commitment,
          },
        };

        return result;
      }
    } catch (err) {
      console.error(err);
      console.error('Verify failed');
      return;
    }
  };
}

const verifier = new Verifier();

export default verifier;
