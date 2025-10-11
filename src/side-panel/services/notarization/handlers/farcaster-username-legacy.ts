import { NotarizationBase } from '../notarization-base';
import { RequestRecorder } from '../../requests-recorder';
import { Request } from '../../../common/types';
import { TLSNotary } from '../../tlsn';
import { Commit } from 'tlsn-js';
import { parse, Pointers, Mapping } from 'json-source-map';

export class NotarizationFarcasterUsername extends NotarizationBase {
  requestRecorder: RequestRecorder = new RequestRecorder(
    [
      {
        method: 'GET',
        urlPattern: 'https://client.farcaster.xyz/v2/onboarding-state',
      },
    ],
    this.onRequestsCaptured.bind(this),
  );

  public async onStart(): Promise<void> {
    this.requestRecorder.start();

    await chrome.tabs.create({ url: 'https://farcaster.xyz' });

    // check if on login page => this.setMessage('...')
    this.currentStep = 1;
    if (this.currentStepUpdateCallback)
      this.currentStepUpdateCallback(this.currentStep);
  }

  private async onRequestsCaptured(log: Array<Request>) {
    this.currentStep = 2;
    if (this.currentStepUpdateCallback)
      this.currentStepUpdateCallback(this.currentStep);

    try {
      const notary = await TLSNotary.new(
        {
          serverDns: 'client.farcaster.xyz',
          maxSentData: 2048,
          maxRecvData: 8192,
        },
        {
          logEveryNMessages: 100,
          verbose: true,
          logPrefix: '[WS Monitor / Farcaster-Username]',
          trackSize: true,
          expectedTotalBytes: 55000000 * 1.15,
          enableProgress: true,
          progressUpdateInterval: 500,
        },
      );
      
      delete log[0].headers['Accept-Encoding'];
      
      const result = await notary.transcript(log[0]);
      if (result instanceof Error) {
        this.result(result);
        return;
      }
      const [transcript, message] = result;

      const commit: Commit = {
        sent: [{ start: 0, end: transcript.sent.length }],
        recv: [{ start: 0, end: message.info.length }],
      };
      
      const jsonStarts: number = Buffer.from(transcript.recv)
        .toString('utf-8')
        .indexOf('{');

      const pointers: Pointers = parse(message.body.toString()).pointers;

      const username: Mapping = pointers['/result/state/user/username'];
      console.log({ pointers });
      
      if (!username.key?.pos) {
        this.result(new Error('username not found'));
        return;
      }
      
      commit.recv.push({
        start: jsonStarts + username.key?.pos,
        end: jsonStarts + username.valueEnd.pos,
      });
      
      console.log({ commit });

      this.result(await notary.notarize(commit));
    } catch (err) {
      this.result(err as Error);
    }
  }

  public async onStop(): Promise<void> {
    this.requestRecorder.stop();
  }
}

