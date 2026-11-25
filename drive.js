export function parseLink(value) {
 const u = new URL(value.trim());
 if(u.protocol !== 'https:' || !['drive.google.com','docs.google.com'].includes(u.hostname)) throw Error('Not a Google Drive link');
 const id = u.pathname.match(/\/d\/([\w-]+)/)?.[1] || u.searchParams.get('id');
 if(!id || !/^[\w-]+$/.test(id)) throw Error('Unsupported link (folders are not supported).');
 const key = u.searchParams.get('resourcekey');
 if(key && !/^[\w-]+$/.test(key)) throw Error('Invalid resource key');
 return {id,key};
}
export async function copyFile(link, token, request = fetch) {
  const response = await request(
    'https://tunistslilxckcjxnlrm.supabase.co/functions/v1/drive-copy',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ link })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}
