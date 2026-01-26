
import React, { useState, useEffect } from 'react';
import { AppState, LogoProject, BrandIdentity, VisualStyle, BrandingKit, VisualStyleType, VisualPreference, User } from './types';
import StepLayout from './components/StepLayout';
import { geminiService } from './services/geminiService';
import { sheetService } from './services/sheetService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.AUTH);
  const [isRegistering, setIsRegistering] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');

  const [projects, setProjects] = useState<LogoProject[]>([]);
  const [currentProject, setCurrentProject] = useState<LogoProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegeneratingPalettes, setIsRegeneratingPalettes] = useState(false);
  const [visiblePromptId, setVisiblePromptId] = useState<string | null>(null);

  // Check for session on load
  useEffect(() => {
    const savedUser = localStorage.getItem('franz_session');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setState(AppState.LANDING);
    }
  }, []);

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegistering) {
        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name: authName,
          email: authEmail,
          password: authPass
        };
        await sheetService.saveData('register', newUser);
        sheetService.saveUserLocal(newUser);
        alert("Conta criada com sucesso!");
        setIsRegistering(false);
      } else {
        const users = sheetService.getUsers();
        const found = users.find(u => u.email === authEmail && u.password === authPass);
        
        if (found || authEmail === "demo@demo.com") { // demo mode
          const sessionUser = found || { id: 'demo', name: 'Demo User', email: authEmail };
          setUser(sessionUser);
          localStorage.setItem('franz_session', JSON.stringify(sessionUser));
          setState(AppState.LANDING);
        } else {
          alert("Credenciais inválidas.");
        }
      }
    } catch (err) {
      alert("Erro na autenticação.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('franz_session');
    setUser(null);
    setState(AppState.AUTH);
  };

  // Project Handlers
  const handleDownloadLogo = (url: string | undefined, name: string) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `logo-${name.toLowerCase().replace(/\s+/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleViewProject = (project: LogoProject) => {
    setCurrentProject({ ...project, step: 5 });
    setState(AppState.WIZARD);
  };

  const startNewProject = () => {
    if (!user) return;
    const newProject: LogoProject = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      step: 1,
      identity: { name: '', slogan: '', segment: '', target: '', personality: '' },
      visualStyle: { style: 'minimalist', preference: 'symbol' },
      generatedLogos: []
    };
    setCurrentProject(newProject);
    setState(AppState.WIZARD);
    setVisiblePromptId(null);
  };

  const updateProject = (updates: Partial<LogoProject>) => {
    if (currentProject) {
      setCurrentProject({ ...currentProject, ...updates });
    }
  };

  const handleRegeneratePalettes = async () => {
    if (!currentProject) return;
    setIsRegeneratingPalettes(true);
    try {
      const kit = await geminiService.suggestBranding(
        currentProject.identity,
        currentProject.visualStyle
      );
      updateProject({ brandingKit: kit });
    } catch (error) {
      console.error("Failed to regenerate palettes", error);
    } finally {
      setIsRegeneratingPalettes(false);
    }
  };

  const handleNextStep = async () => {
    if (!currentProject) return;

    if (currentProject.step === 3) {
      setIsLoading(true);
      try {
        const prompts = await geminiService.generateLogoPrompts(
          currentProject.identity,
          currentProject.visualStyle,
          currentProject.brandingKit!
        );
        const logoUrls = await Promise.all(prompts.map(p => geminiService.generateLogoImage(p)));
        const generatedLogos = logoUrls.map((url, i) => ({
          id: `logo-${i}`,
          url,
          prompt: prompts[i]
        }));
        updateProject({ step: 4, generatedLogos });
      } catch (error) {
        alert("Erro ao gerar logotipos.");
      } finally {
        setIsLoading(false);
      }
    } else if (currentProject.step === 2) {
      setIsLoading(true);
      try {
        const kit = await geminiService.suggestBranding(currentProject.identity, currentProject.visualStyle);
        updateProject({ step: 3, brandingKit: kit });
      } catch (error) {
        alert("Erro ao sugerir kit.");
      } finally {
        setIsLoading(false);
      }
    } else if (currentProject.step === 5) {
      const finalProject = { ...currentProject };
      await sheetService.saveData('saveProject', finalProject);
      setProjects(prev => {
        const index = prev.findIndex(p => p.id === finalProject.id);
        if (index > -1) {
          const newProjects = [...prev];
          newProjects[index] = finalProject;
          return newProjects;
        }
        return [...prev, finalProject];
      });
      setState(AppState.DASHBOARD);
    } else {
      updateProject({ step: currentProject.step + 1 });
    }
  };

  const handlePrevStep = () => {
    if (currentProject && currentProject.step > 1) {
      updateProject({ step: currentProject.step - 1 });
    } else {
      setState(AppState.LANDING);
    }
  };

  // RENDER AUTH
  if (state === AppState.AUTH) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-brand-gold rounded-2xl flex items-center justify-center font-bold text-black font-serif text-3xl mx-auto mb-4">F</div>
            <h1 className="text-3xl font-serif font-bold tracking-tight">Logo Franz</h1>
            <p className="text-brand-400 mt-2">{isRegistering ? 'Crie sua conta premium' : 'Acesse seu painel de design'}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 bg-brand-800/20 border border-white/10 p-8 rounded-3xl">
            {isRegistering && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-400 uppercase">Nome Completo</label>
                <input 
                  type="text" required
                  className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none transition-colors"
                  value={authName} onChange={e => setAuthName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-400 uppercase">E-mail</label>
              <input 
                type="email" required
                className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none transition-colors"
                value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-400 uppercase">Senha</label>
              <input 
                type="password" required
                className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none transition-colors"
                value={authPass} onChange={e => setAuthPass(e.target.value)}
              />
            </div>
            
            <button 
              type="submit" disabled={isLoading}
              className="w-full bg-brand-gold text-black py-4 rounded-xl font-bold hover:bg-white transition-all mt-4 disabled:opacity-50"
            >
              {isLoading ? 'Processando...' : (isRegistering ? 'Criar Conta' : 'Entrar')}
            </button>
          </form>

          <div className="text-center mt-6">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-brand-400 hover:text-brand-gold transition-colors text-sm"
            >
              {isRegistering ? 'Já tem uma conta? Entre aqui' : 'Não tem conta? Cadastre-se agora'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER LANDING
  if (state === AppState.LANDING) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center font-bold text-black font-serif text-xl">F</div>
            <span className="text-2xl font-bold tracking-tighter">LOGO FRANZ</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setState(AppState.DASHBOARD)} className="text-brand-400 hover:text-white transition-colors">Meus Projetos</button>
            <button onClick={handleLogout} className="text-red-500 text-sm hover:underline">Sair</button>
          </div>
        </nav>
        
        <main className="flex-grow flex flex-col items-center justify-center text-center px-6 py-20">
          <h2 className="text-brand-gold font-bold tracking-widest uppercase mb-4 animate-pulse">Olá, {user?.name.split(' ')[0]}</h2>
          <h1 className="text-6xl md:text-8xl font-serif font-bold mb-8 max-w-4xl leading-tight">
            Sua identidade visual <br/> em <span className="text-brand-gold italic">5 passos</span>.
          </h1>
          <p className="text-xl text-brand-400 mb-12 max-w-2xl leading-relaxed">
            A plataforma definitiva para quem busca solidez e rapidez no branding estratégico.
          </p>
          <button 
            onClick={startNewProject}
            className="bg-white text-black hover:bg-brand-gold hover:text-white px-12 py-5 rounded-full text-xl font-bold transition-all transform hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            Começar Novo Projeto
          </button>
        </main>
      </div>
    );
  }

  // RENDER DASHBOARD
  if (state === AppState.DASHBOARD) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <header className="max-w-7xl mx-auto mb-16 flex justify-between items-center">
          <h1 className="text-3xl font-bold font-serif">Seu Portfólio</h1>
          <div className="flex gap-4">
            <button onClick={() => setState(AppState.LANDING)} className="text-brand-400 px-4 py-2 hover:text-white">Início</button>
            <button onClick={startNewProject} className="bg-brand-gold text-black px-6 py-2 rounded-full font-bold">Novo Logo</button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.length === 0 ? (
            <div className="col-span-full py-32 text-center border-2 border-dashed border-brand-800 rounded-3xl">
              <p className="text-brand-500 text-xl mb-6">Nenhum projeto salvo no momento.</p>
              <button onClick={startNewProject} className="text-brand-gold font-bold underline">Iniciar primeira criação</button>
            </div>
          ) : (
            projects.map(p => {
              const mainLogo = p.generatedLogos.find(l => l.id === p.selectedLogoId) || p.generatedLogos[0];
              return (
                <div key={p.id} className="group bg-brand-800/30 border border-white/10 p-6 rounded-3xl hover:border-brand-gold transition-all">
                  <div className="aspect-square bg-white rounded-2xl mb-6 flex items-center justify-center overflow-hidden">
                     <img src={mainLogo?.url} alt={p.identity.name} className="w-full h-full object-contain" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{p.identity.name}</h3>
                  <div className="flex gap-4 mt-4">
                    <button onClick={() => handleViewProject(p)} className="flex-grow py-2 bg-white/5 rounded-lg">Visualizar</button>
                    <button onClick={() => handleDownloadLogo(mainLogo?.url, p.identity.name)} className="px-4 py-2 bg-brand-gold/10 text-brand-gold rounded-lg">↓</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // WIZARD FLOW (Steps 1-5)
  return (
    <div className="bg-black text-white">
      {currentProject?.step === 1 && (
        <StepLayout
          title="Identidade da Marca" subtitle="Tudo começa com a clareza do seu propósito."
          stepNumber={1} totalSteps={5} onBack={handlePrevStep} onNext={handleNextStep}
          nextDisabled={!currentProject.identity.name || !currentProject.identity.segment}
        >
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-brand-400 font-medium">Nome da Marca</label>
                <input 
                  type="text" className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none"
                  value={currentProject.identity.name} onChange={e => updateProject({ identity: { ...currentProject.identity, name: e.target.value }})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-brand-400 font-medium">Slogan</label>
                <input 
                  type="text" className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none"
                  value={currentProject.identity.slogan} onChange={e => updateProject({ identity: { ...currentProject.identity, slogan: e.target.value }})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-brand-400 font-medium">Segmento</label>
              <input 
                type="text" className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none"
                value={currentProject.identity.segment} onChange={e => updateProject({ identity: { ...currentProject.identity, segment: e.target.value }})}
              />
            </div>
            <div className="space-y-4">
              <label className="text-brand-400 font-medium">Personalidade</label>
              <div className="flex flex-wrap gap-4">
                {['Moderna', 'Sofisticada', 'Ousada', 'Tradicional', 'Minimalista'].map(p => (
                  <button
                    key={p} onClick={() => updateProject({ identity: { ...currentProject.identity, personality: p }})}
                    className={`px-6 py-2 rounded-full border transition-all ${currentProject.identity.personality === p ? 'bg-brand-gold border-brand-gold text-black' : 'border-white/10 text-brand-400 hover:border-white'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </StepLayout>
      )}

      {currentProject?.step === 2 && (
        <StepLayout
          title="Estilo Visual" subtitle="Defina o DNA estético que representará sua visão."
          stepNumber={2} totalSteps={5} onBack={handlePrevStep} onNext={handleNextStep}
        >
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['minimalist', 'technological', 'classic', 'modern', 'premium'].map(s => (
                <button
                  key={s} onClick={() => updateProject({ visualStyle: { ...currentProject.visualStyle, style: s as VisualStyleType }})}
                  className={`text-left p-6 rounded-2xl border transition-all ${currentProject.visualStyle.style === s ? 'bg-brand-gold border-brand-gold text-black' : 'bg-brand-800/30 border-white/10 hover:border-white'}`}
                >
                  <div className="font-bold text-lg capitalize">{s}</div>
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              {['symbol', 'letter', 'abstract'].map(p => (
                <button
                  key={p} onClick={() => updateProject({ visualStyle: { ...currentProject.visualStyle, preference: p as VisualPreference }})}
                  className={`flex-grow p-6 rounded-2xl border transition-all ${currentProject.visualStyle.preference === p ? 'bg-brand-gold border-brand-gold text-black' : 'bg-brand-800/30 border-white/10 hover:border-white'}`}
                >
                  <div className="font-bold text-lg capitalize">{p}</div>
                </button>
              ))}
            </div>
          </div>
        </StepLayout>
      )}

      {currentProject?.step === 3 && (
        <StepLayout
          title="Cores & Tipografia" subtitle="Damos vida à sua identidade."
          stepNumber={3} totalSteps={5} onBack={handlePrevStep} onNext={handleNextStep}
          isLoading={isLoading}
        >
          <div className="space-y-12">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold">Paletas Sugeridas</h3>
              <button onClick={handleRegeneratePalettes} disabled={isRegeneratingPalettes} className="text-brand-gold font-bold">Gerar mais</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {currentProject.brandingKit?.palettes.map((palette, pIdx) => (
                <button
                  key={pIdx} onClick={() => updateProject({ brandingKit: { ...currentProject.brandingKit!, colors: palette }})}
                  className={`bg-brand-800/30 border p-4 rounded-3xl ${JSON.stringify(currentProject.brandingKit?.colors) === JSON.stringify(palette) ? 'border-brand-gold bg-brand-gold/5' : 'border-white/10'}`}
                >
                  <div className="flex h-16 rounded-xl overflow-hidden mb-4">
                    {palette.map((c, idx) => <div key={idx} className="flex-grow h-full" style={{ backgroundColor: c }} />)}
                  </div>
                </button>
              ))}
            </div>
            <div className="bg-brand-800/30 border border-white/10 p-8 rounded-3xl">
              <span className="text-xs font-bold text-brand-gold uppercase tracking-widest block mb-2">Tipografia</span>
              <h4 className="text-4xl font-bold" style={{ fontFamily: 'serif' }}>{currentProject.brandingKit?.typography.primary}</h4>
              <p className="text-brand-500 mt-2">{currentProject.brandingKit?.typography.secondary}</p>
            </div>
          </div>
        </StepLayout>
      )}

      {currentProject?.step === 4 && (
        <StepLayout
          title="Geração" subtitle="Escolha sua variação favorita."
          stepNumber={4} totalSteps={5} onBack={handlePrevStep} onNext={handleNextStep}
          nextDisabled={!currentProject.selectedLogoId}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {currentProject.generatedLogos.map((logo) => (
              <div key={logo.id} className="flex flex-col gap-4">
                <button
                  onClick={() => updateProject({ selectedLogoId: logo.id })}
                  className={`relative bg-white p-4 rounded-3xl border-4 transition-all ${currentProject.selectedLogoId === logo.id ? 'border-brand-gold scale-[1.02]' : 'border-transparent'}`}
                >
                  <img src={logo.url} alt="Logo" className="w-full aspect-square object-contain" />
                </button>
                <button onClick={() => setVisiblePromptId(visiblePromptId === logo.id ? null : logo.id)} className="text-xs text-brand-400 underline">
                  {visiblePromptId === logo.id ? 'Ocultar Prompt' : 'Ver Prompt'}
                </button>
                {visiblePromptId === logo.id && <p className="text-[10px] text-brand-500 italic">"{logo.prompt}"</p>}
              </div>
            ))}
          </div>
        </StepLayout>
      )}

      {currentProject?.step === 5 && (
        <StepLayout
          title="Finalização" subtitle="Seu kit de marca premium pronto."
          stepNumber={5} totalSteps={5} onBack={handlePrevStep} onNext={handleNextStep}
        >
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="w-full md:w-1/2 bg-white rounded-3xl p-12 flex items-center justify-center">
                <img src={currentProject.generatedLogos.find(l => l.id === currentProject.selectedLogoId)?.url} alt="Final" className="w-full h-auto" />
              </div>
              <div className="w-full md:w-1/2 space-y-6">
                <div className="bg-brand-800/30 p-6 rounded-2xl border border-white/10">
                  <h4 className="font-bold mb-4">Exportar Arquivos</h4>
                  <button 
                    onClick={() => handleDownloadLogo(currentProject.generatedLogos.find(l => l.id === currentProject.selectedLogoId)?.url, currentProject.identity.name)}
                    className="w-full py-3 bg-brand-gold text-black rounded-xl font-bold"
                  >
                    Download Completo (ZIP)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </StepLayout>
      )}
    </div>
  );
};

export default App;
