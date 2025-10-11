// Content script for Farcaster that listens for messages to fetch followers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FETCH_FARCASTER_FOLLOWERS') {
    const { fid, targetUsernames } = message.payload;
    
    // Function to fetch all followers pages until we find one of our target usernames or exhaust all pages
    const fetchFollowersUntilTarget = async (cursor: string | null = null): Promise<void> => {
      try {
        const url = cursor 
          ? `https://client.farcaster.xyz/v2/followers?fid=${fid}&limit=100&cursor=${cursor}`
          : `https://client.farcaster.xyz/v2/followers?fid=${fid}&limit=100`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`[Farcaster] Fetched followers page, got ${data?.result?.users?.length || 0} users`);
        
        // Check if any of our target usernames are in this page
        const foundUser = data?.result?.users?.find((user: any) => 
          targetUsernames.includes(user.username)
        );
        
        if (foundUser) {
          console.log(`[Farcaster] Found ${foundUser.username} in this page!`);
          return;
        }
        
        // If there's a next cursor and we haven't found a target, fetch next page
        if (data?.next?.cursor) {
          console.log(`[Farcaster] Target usernames not found yet, fetching next page...`);
          await fetchFollowersUntilTarget(data.next.cursor);
        } else {
          console.log(`[Farcaster] Reached end of followers list, none of [${targetUsernames.join(', ')}] found`);
        }
      } catch (err) {
        console.error('[Farcaster] Error fetching followers:', err);
      }
    };
    
    fetchFollowersUntilTarget().then(() => {
      sendResponse({ success: true });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    
    return true; // Keep message channel open for async response
  }
});

