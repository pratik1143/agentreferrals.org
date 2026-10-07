import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('AgentReferrals UI failed to render', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24,background:'#f5f7fb',fontFamily:'system-ui,sans-serif',color:'#183451'}}>
      <section style={{maxWidth:520,padding:28,border:'1px solid #e1e8f0',borderRadius:14,background:'#fff',boxShadow:'0 16px 45px #17395b12'}}>
        <p style={{margin:'0 0 8px',fontSize:11,fontWeight:800,letterSpacing:1,color:'#3478c7'}}>AGENTREFERRALS</p>
        <h1 style={{margin:'0 0 10px',fontSize:22}}>Workspace couldn’t load</h1>
        <p style={{margin:'0 0 18px',fontSize:14,lineHeight:1.6,color:'#61758c'}}>A page error interrupted the workspace. Reload the page to try again.</p>
        <details style={{marginBottom:18,color:'#6d7f94',fontSize:12}}><summary>Error details</summary><pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{this.state.error?.message||String(this.state.error)}</pre></details>
        <button onClick={()=>window.location.reload()} style={{height:40,padding:'0 16px',border:0,borderRadius:8,background:'#2878e3',color:'#fff',fontWeight:700,cursor:'pointer'}}>Reload workspace</button>
      </section>
    </main>;
  }
}
