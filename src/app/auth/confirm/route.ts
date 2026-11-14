import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {NextResponse} from 'next/server';
export async function GET(request:Request){
 const url=new URL(request.url);const token_hash=url.searchParams.get('token_hash');
 if(token_hash&&url.searchParams.get('type')==='email'&&process.env.NEXT_PUBLIC_SUPABASE_URL&&process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY){
 const store=await cookies();const sb=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>store.getAll(),setAll:values=>{for(const {name,value,options} of values)store.set(name,value,options)}}});
 const {error}=await sb.auth.verifyOtp({token_hash,type:'email'});if(!error)return NextResponse.redirect(new URL('/teacher',url));
 }
 return NextResponse.redirect(new URL('/teacher?authError=expired',url));
}
