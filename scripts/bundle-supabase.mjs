import {build} from 'esbuild';
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/vendor/supabase/client.js',legalComments:'eof'});

await build({stdin:{contents:"export {Upload} from 'tus-js-client';",resolveDir:process.cwd(),loader:'js'},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,outfile:'dist/vendor/supabase/upload.js',legalComments:'eof'});
