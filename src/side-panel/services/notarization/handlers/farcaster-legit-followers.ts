import { NotarizationBase } from '../notarization-base';
import { RequestRecorder } from '../../requests-recorder';
import { Request } from '../../../common/types';
import { TLSNotary } from '../../tlsn';
import { Commit } from 'tlsn-js';
import { parse, Pointers, Mapping } from 'json-source-map';

export class NotarizationFarcasterLegitFollowers extends NotarizationBase {
  // Configure target usernames to check for (easily add more here)
  private readonly TARGET_USERNAMES = [
    'vitalik.eth', // THE vitalik
    'v', // Varun Srinivasan (Farcaster co-founder)
    'dwr.eth', // Dan Romero (Farcaster co-founder)
    'jessepollak', // Jesse Pollak (Base)
    'balajis.eth', // Balaji Srinivasan
  ];
  
  private capturedRequests: Array<Request> = [];
  private userFid: number | null = null;
  private currentTabId: number | null = null;
  private foundUsername: string | null = null;
  
  requestRecorder: RequestRecorder = new RequestRecorder(
    [
      {
        method: 'GET',
        urlPattern: 'https://client.farcaster.xyz/v2/onboarding-state',
      },
      {
        method: 'GET',
        urlPattern: 'https://client.farcaster.xyz/v2/followers*',
      },
    ],
    this.onRequestsCaptured.bind(this),
  );

  public async onStart(): Promise<void> {
    this.requestRecorder.start();

    const tab = await chrome.tabs.create({ url: 'https://farcaster.xyz' });
    this.currentTabId = tab.id || null;

    // check if on login page => this.setMessage('...')
    this.currentStep = 1;
    if (this.currentStepUpdateCallback)
      this.currentStepUpdateCallback(this.currentStep);
  }

  private async onRequestsCaptured(log: Array<Request>) {
    // Store captured requests
    this.capturedRequests.push(...log);
    
    // Check if we have the onboarding-state request
    const onboardingRequest = this.capturedRequests.find(
      req => req.url.includes('/onboarding-state')
    );
    
    // Check if we already have FID and need to trigger followers request
    if (onboardingRequest && !this.userFid) {
      // We need to process the transcript to get the FID
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
            logPrefix: '[WS Monitor / Farcaster-Legit-Followers-FID-Extract]',
            trackSize: true,
            expectedTotalBytes: 55000000 * 1.15,
            enableProgress: false,
            progressUpdateInterval: 500,
          },
        );
        
        const reqCopy = { ...onboardingRequest };
        delete reqCopy.headers['Accept-Encoding'];
        
        const result = await notary.transcript(reqCopy);
        if (!(result instanceof Error)) {
          const [, message] = result;
          const responseData = JSON.parse(message.body.toString());
          this.userFid = responseData?.result?.state?.user?.fid;
          
          if (this.userFid) {
            console.log(`[Farcaster] Found user FID: ${this.userFid}`);
            await this.triggerFollowersRequest(this.userFid);
          }
        }
      } catch (err) {
        console.error('[Farcaster] Error extracting FID:', err);
      }
    }
    
    // Check if we have the followers requests
    const followersRequests = this.capturedRequests.filter(
      req => req.url.includes('/followers?fid=')
    );
    
    if (onboardingRequest && followersRequests.length > 0) {
      // Find which followers request contains one of our target usernames
      const followersRequestWithTarget = await this.findFollowersRequestWithTargetUsername(followersRequests);
      
      if (followersRequestWithTarget) {
        // We have both requests, proceed with notarization
        await this.processNotarization(onboardingRequest, followersRequestWithTarget);
      }
    }
  }

  private async findFollowersRequestWithTargetUsername(
    followersRequests: Array<Request>
  ): Promise<Request | null> {
    // Check each followers request to see which one contains one of our target usernames
    for (const request of followersRequests) {
      try {
        const notary = await TLSNotary.new(
          {
            serverDns: 'client.farcaster.xyz',
            maxSentData: 2048,
            maxRecvData: 16384,
          },
          {
            logEveryNMessages: 100,
            verbose: false,
            logPrefix: '[WS Monitor / Farcaster-Check-Target]',
            trackSize: false,
            expectedTotalBytes: 55000000 * 1.15,
            enableProgress: false,
            progressUpdateInterval: 500,
          },
        );
        
        const reqCopy = { ...request };
        delete reqCopy.headers['Accept-Encoding'];
        
        const result = await notary.transcript(reqCopy);
        if (!(result instanceof Error)) {
          const [, message] = result;
          const responseData = JSON.parse(message.body.toString());
          const users = responseData?.result?.users || [];
          
          // Check if any of our target usernames are in this page
          for (const targetUsername of this.TARGET_USERNAMES) {
            const foundUser = users.find((user: any) => user.username === targetUsername);
            if (foundUser) {
              this.foundUsername = targetUsername;
              console.log(`[Farcaster] Found the followers request containing ${targetUsername}`);
              return request;
            }
          }
        }
      } catch (err) {
        console.error('[Farcaster] Error checking request for target usernames:', err);
      }
    }
    
    console.log(`[Farcaster] None of the target usernames (${this.TARGET_USERNAMES.join(', ')}) found in captured followers requests`);
    return null;
  }

  private async triggerFollowersRequest(fid: number): Promise<void> {
    // Send a message to the Farcaster content script to fetch followers
    if (this.currentTabId) {
      try {
        await chrome.tabs.sendMessage(this.currentTabId, {
          type: 'FETCH_FARCASTER_FOLLOWERS',
          payload: {
            fid,
            targetUsernames: this.TARGET_USERNAMES,
          },
        });
        console.log('[Farcaster] Sent message to content script to fetch followers');
      } catch (err) {
        console.error('[Farcaster] Error sending message to content script:', err);
      }
    }
  }

  private async processNotarization(
    onboardingRequest: Request,
    followersRequest: Request
  ): Promise<void> {
    this.currentStep = 2;
    if (this.currentStepUpdateCallback)
      this.currentStepUpdateCallback(this.currentStep);

    try {
      const notary = await TLSNotary.new(
        {
          serverDns: 'client.farcaster.xyz',
          maxSentData: 4096,
          maxRecvData: 16384,
        },
        {
          logEveryNMessages: 100,
          verbose: true,
          logPrefix: '[WS Monitor / Farcaster-Legit-Followers]',
          trackSize: true,
          expectedTotalBytes: 55000000 * 1.15,
          enableProgress: true,
          progressUpdateInterval: 500,
        },
      );
      
      // Process onboarding-state request for username
      delete onboardingRequest.headers['Accept-Encoding'];
      
      const result1 = await notary.transcript(onboardingRequest);
      if (result1 instanceof Error) {
        this.result(result1);
        return;
      }
      const [transcript1, message1] = result1;

      const commit: Commit = {
        sent: [{ start: 0, end: transcript1.sent.length }],
        recv: [{ start: 0, end: message1.info.length }],
      };
      
      const jsonStarts1: number = Buffer.from(transcript1.recv)
        .toString('utf-8')
        .indexOf('{');

      const pointers1: Pointers = parse(message1.body.toString()).pointers;

      const username: Mapping = pointers1['/result/state/user/username'];
      const fid: Mapping = pointers1['/result/state/user/fid'];
      console.log({ pointers: pointers1 });
      
      if (!username.key?.pos) {
        this.result(new Error('username not found'));
        return;
      }
      
      if (!fid.key?.pos) {
        this.result(new Error('fid not found'));
        return;
      }
      
      // Commit username and fid from onboarding-state
      commit.recv.push({
        start: jsonStarts1 + username.key?.pos,
        end: jsonStarts1 + username.valueEnd.pos,
      });
      
      commit.recv.push({
        start: jsonStarts1 + fid.key?.pos,
        end: jsonStarts1 + fid.valueEnd.pos,
      });
      
      // Process followers request to check for vitalik.eth
      delete followersRequest.headers['Accept-Encoding'];
      
      const result2 = await notary.transcript(followersRequest);
      if (result2 instanceof Error) {
        this.result(result2);
        return;
      }
      const [transcript2, message2] = result2;
      
      const jsonStarts2: number = Buffer.from(transcript2.recv)
        .toString('utf-8')
        .indexOf('{');
      
      const followersData = JSON.parse(message2.body.toString());
      const pointers2: Pointers = parse(message2.body.toString()).pointers;
      
      // Check if our target username is in the followers list
      let targetFollowerIndex = -1;
      const users = followersData?.result?.users || [];
      
      // Use the username we found earlier, or fall back to checking all targets
      const usernameToFind = this.foundUsername || this.TARGET_USERNAMES[0];
      
      for (let i = 0; i < users.length; i++) {
        if (this.TARGET_USERNAMES.includes(users[i].username)) {
          targetFollowerIndex = i;
          this.foundUsername = users[i].username;
          break;
        }
      }
      
      if (targetFollowerIndex === -1) {
        this.result(new Error(`None of the target usernames (${this.TARGET_USERNAMES.join(', ')}) are following this user`));
        return;
      }
      
      console.log(`[Farcaster] Found ${this.foundUsername} at followers index ${targetFollowerIndex}`);
      
      // Commit the target follower entry
      const targetUsername: Mapping = pointers2[`/result/users/${targetFollowerIndex}/username`];
      const targetFollowedBy: Mapping = pointers2[`/result/users/${targetFollowerIndex}/viewerContext/followedBy`];
      
      if (!targetUsername.key?.pos) {
        this.result(new Error(`${this.foundUsername} username pointer not found`));
        return;
      }
      
      if (!targetFollowedBy.key?.pos) {
        this.result(new Error(`${this.foundUsername} followedBy pointer not found`));
        return;
      }
      
      // Commit target username
      commit.recv.push({
        start: jsonStarts2 + targetUsername.key?.pos,
        end: jsonStarts2 + targetUsername.valueEnd.pos,
      });
      
      // Commit followedBy status (should be true)
      commit.recv.push({
        start: jsonStarts2 + targetFollowedBy.key?.pos,
        end: jsonStarts2 + targetFollowedBy.valueEnd.pos,
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

