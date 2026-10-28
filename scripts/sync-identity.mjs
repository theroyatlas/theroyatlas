import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const repo='theroyatlas/builder-context',digest=s=>createHash('sha256').update(s).digest('hex');
export async function syncProfile({root='.',local=process.env.IDENTITY_SOURCE_DIR,commit=process.env.IDENTITY_SOURCE_COMMIT}={}){
  let sha=commit;
  if(!local&&!sha){const r=await fetch(`https://api.github.com/repos/${repo}/commits/main`,{headers:process.env.GH_TOKEN?{Authorization:`Bearer ${process.env.GH_TOKEN}`}:{},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Source lookup: ${r.status}`);sha=(await r.json()).sha;}
  if(!local&&!/^[a-f0-9]{40}$/.test(sha))throw Error('Immutable source commit required');
  async function get(path){if(local)return readFile(join(local,path),'utf8');const r=await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/${path}`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Source ${path}: ${r.status}`);return r.text();}
  const manifest=JSON.parse(await get('generated/export-manifest.json')),content=await get('generated/profile-readme.md');
  if(digest(content)!==manifest.files['generated/profile-readme.md']||!content.includes(manifest.revision)||!content.startsWith('<!-- Generated from theroyatlas/builder-context.'))throw Error('README manifest/revision mismatch');
  await mkdir(root,{recursive:true});let previous='';try{previous=await readFile(join(root,'README.md'),'utf8');}catch{}
  if(previous!==content){await writeFile(join(root,'README.md'),content);await writeFile(join(root,'identity-source.json'),JSON.stringify({repository:repo,commit:sha??'isolated-fixture',revision:manifest.revision,readmeHash:digest(content)},null,2)+'\n');}
  return {revision:manifest.revision,commit:sha,changed:previous!==content};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(await syncProfile());
