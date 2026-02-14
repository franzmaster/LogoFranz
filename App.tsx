
import React, { useState, useEffect } from 'react';
import { AppState, LogoProject, BrandIdentity, VisualStyle, BrandingKit, VisualStyleType, VisualPreference, User } from './types';
import StepLayout from './components/StepLayout';
import { geminiService } from './services/geminiService';
import { sheetService } from './services/sheetService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.AUTH);
  const [isRegistering, setIsRegistering] = useState(true); // Alterado para true por padrão
  const [user, setUser] = useState<User | null>(null);
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authName, setAuthName] = useState('');

  // Profile Form State
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');

  // Notification State
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const [projects, setProjects] = useState<LogoProject[]>([]);
  const [currentProject, setCurrentProject] = useState<LogoProject | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegeneratingPalettes, setIsRegeneratingPalettes] = useState(false);
  const [isGeneratingSvg, setIsGeneratingSvg] = useState(false);
  const [visiblePromptId, setVisiblePromptId] = useState<string | null>(null);
  const [showEditOptions, setShowEditOptions] = useState(false);
  
  // Modal State
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<AppState | null>(null);

  // Check for session on load
  useEffect(() => {
    const savedUser = localStorage.getItem('franz_session');
    if (savedUser) {
      const parsed = JSON.parse(savedUser);
      setUser(parsed);
      setProfileName(parsed.name);
      setProfileEmail(parsed.email);
      setProjects(sheetService.getProjectsLocal(parsed.id));
      setState(AppState.LANDING);
    }
  }, []);

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Validação básica
        if (!authName || !authEmail || !authPass) {
          alert("Por favor, preencha todos os campos para o cadastro.");
          return;
        }

        const newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name: authName,
          email: authEmail,
          password: authPass
        };
        
        await sheetService.saveData('register', newUser);
        sheetService.saveUserLocal(newUser);
        alert("Conta criada com sucesso! Agora você pode entrar.");
        setIsRegistering(false); // Muda para login após sucesso no cadastro
      } else {
        const users = sheetService.getUsers();
        const found = users.find(u => u.email === authEmail && u.password === authPass);
        
        if (found) {
          setUser(found);
          setProfileName(found.name);
          setProfileEmail(found.email);
          setProjects(sheetService.getProjectsLocal(found.id));
          localStorage.setItem('franz_session', JSON.stringify(found));
          setState(AppState.LANDING);
        } else {
          alert("E-mail não encontrado ou senha incorreta. Se você ainda não tem uma conta, por favor, realize o cadastro primeiro.");
        }
      }
    } catch (err) {
      alert("Erro na autenticação. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);

    try {
      const updatedUser = { ...user, name: profileName, email: profileEmail };
      await sheetService.saveData('updateProfile', updatedUser);
      sheetService.updateUserLocal(updatedUser);
      setUser(updatedUser);
      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      alert("Erro ao atualizar perfil.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('franz_session');
    setUser(null);
    setProjects([]);
    setState(AppState.AUTH);
  };

  // Notification helper
  const triggerNotification = (message: string) => {
    setDownloadStatus(message);
    setTimeout(() => setDownloadStatus(null), 3000);
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
    triggerNotification('Download PNG concluído com sucesso!');
  };

  const handleDownloadSvg = async () => {
    if (!currentProject) return;
    const selectedLogo = currentProject.generatedLogos.find(l => l.id === currentProject.selectedLogoId);
    if (!selectedLogo || !currentProject.brandingKit) return;

    setIsGeneratingSvg(true);
    try {
      const svgCode = await geminiService.generateSvgCode(
        currentProject.identity,
        selectedLogo.prompt,
        currentProject.brandingKit
      );

      if (!svgCode) {
        throw new Error("Failed to generate SVG");
      }

      const blob = new Blob([svgCode], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `logo-${currentProject.identity.name.toLowerCase().replace(/\s+/g, '-')}.svg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      triggerNotification('Download SVG concluído com sucesso!');
    } catch (error) {
      console.error(error);
      alert("Erro ao processar o arquivo vetorial. Tente novamente.");
    } finally {
      setIsGeneratingSvg(false);
    }
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
      identity: { name: '', slogan: '', segment: '', target: '', personality: '', colorPreferences: '', excludedColors: '' },
      visualStyle: { style: 'minimalist', preference: 'symbol' },
      generatedLogos: []
    };
    setCurrentProject(newProject);
    setState(AppState.WIZARD);
    setVisiblePromptId(null);
    setShowEditOptions(false);
    setShowSaveModal(false);
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
      alert("Erro ao regenerar paletas.");
    } finally {
      setIsRegeneratingPalettes(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!currentProject) return;
    setIsLoading(true);
    try {
      const finalProject = { ...currentProject };
      await sheetService.saveData('saveProject', finalProject);
      sheetService.saveProjectLocal(finalProject);
      
      setProjects(prev => {
        const index = prev.findIndex(p => p.id === finalProject.id);
        if (index > -1) {
          const newProjects = [...prev];
          newProjects[index] = finalProject;
          return newProjects;
        }
        return [...prev, finalProject];
      });
      
      setShowSaveModal(false);
      setState(pendingNavigation || AppState.DASHBOARD);
      setCurrentProject(null);
      setPendingNavigation(null);
    } catch (error) {
      alert("Erro ao salvar o projeto.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiscardChanges = () => {
    setShowSaveModal(false);
    setState(pendingNavigation || AppState.DASHBOARD);
    setCurrentProject(null);
    setPendingNavigation(null);
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
      setPendingNavigation(AppState.DASHBOARD);
      setShowSaveModal(true);
    } else {
      updateProject({ step: currentProject.step + 1 });
    }
  };

  const handlePrevStep = () => {
    if (currentProject && currentProject.step > 1) {
      updateProject({ step: currentProject.step - 1 });
    } else {
      setPendingNavigation(AppState.LANDING);
      setShowSaveModal(true);
    }
  };

  const SaveModal = () => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-brand-800 border border-white/10 p-8 rounded-[2rem] max-w-md w-full shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </div>
          <h3 className="text-2xl font-serif font-bold text-white mb-2">Salvar Projeto?</h3>
          <p className="text-brand-400">Deseja salvar sua identidade visual antes de sair?</p>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={handleConfirmSave}
            disabled={isLoading}
            className="w-full bg-brand-gold text-black py-4 rounded-xl font-bold hover:bg-white transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : null}
            Sim, Salvar e Sair
          </button>
          <button 
            onClick={handleDiscardChanges}
            disabled={isLoading}
            className="w-full bg-white/5 text-white py-4 rounded-xl font-bold hover:bg-white/10 transition-all"
          >
            Sair sem Salvar
          </button>
          <button 
            onClick={() => setShowSaveModal(false)}
            disabled={isLoading}
            className="w-full text-brand-500 py-2 text-sm hover:text-white transition-all"
          >
            Continuar Editando
          </button>
        </div>
      </div>
    </div>
  );

  const Notification = () => (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-brand-gold text-black px-6 py-3 rounded-full font-bold shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
        {downloadStatus}
      </div>
    </div>
  );

  if (state === AppState.AUTH) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-brand-gold rounded-2xl flex items-center justify-center font-bold text-black font-serif text-3xl mx-auto mb-4">F</div>
            <h1 className="text-3xl font-serif font-bold tracking-tight">Logo Franz</h1>
            <p className="text-brand-400 mt-2">{isRegistering ? 'Crie sua conta premium para começar' : 'Acesse seu painel de design'}</p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 bg-brand-800/20 border border-white/10 p-8 rounded-3xl">
            {isRegistering && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" required
                  placeholder="Seu Nome Completo"
                  className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none transition-colors"
                  value={authName} onChange={e => setAuthName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">E-mail</label>
              <input 
                type="email" required
                placeholder="seu@email.com"
                className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none transition-colors"
                value={authEmail} onChange={e => setAuthEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">Senha</label>
              <input 
                type="password" required
                placeholder="****"
                className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none transition-colors"
                value={authPass} onChange={e => setAuthPass(e.target.value)}
              />
            </div>
            
            <button 
              type="submit" disabled={isLoading}
              className="w-full bg-brand-gold text-black py-4 rounded-xl font-bold hover:bg-white transition-all mt-4 disabled:opacity-50"
            >
              {isLoading ? 'Processando...' : (isRegistering ? 'Criar Conta Premium' : 'Entrar no Sistema')}
            </button>
          </form>

          <div className="text-center mt-6">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-brand-400 hover:text-brand-gold transition-colors text-sm"
            >
              {isRegistering ? 'Já tem uma conta? Clique aqui para entrar' : 'Não tem conta? Cadastre-se agora gratuitamente'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === AppState.LANDING) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col">
        {downloadStatus && <Notification />}
        <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-brand-gold rounded-lg flex items-center justify-center font-bold text-black font-serif text-xl">F</div>
            <span className="text-2xl font-bold tracking-tighter">LOGO FRANZ</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setState(AppState.DASHBOARD)} className="text-brand-400 hover:text-white transition-colors">Meus Projetos</button>
            <button onClick={() => setState(AppState.PROFILE)} className="text-brand-400 hover:text-white transition-colors">Perfil</button>
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

  if (state === AppState.DASHBOARD) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        {downloadStatus && <Notification />}
        <header className="max-w-7xl mx-auto mb-16 flex justify-between items-center">
          <h1 className="text-3xl font-bold font-serif">Seu Portfólio</h1>
          <div className="flex gap-4 items-center">
            <button onClick={() => setState(AppState.LANDING)} className="text-brand-400 px-4 py-2 hover:text-white">Início</button>
            <button onClick={() => setState(AppState.PROFILE)} className="text-brand-400 px-4 py-2 hover:text-white">Perfil</button>
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

  if (state === AppState.PROFILE) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <header className="max-w-4xl mx-auto mb-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setState(AppState.LANDING)} className="text-brand-400 hover:text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold font-serif">Seu Perfil</h1>
          </div>
        </header>

        <main className="max-w-xl mx-auto">
          <div className="bg-brand-800/30 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl">
            <div className="w-24 h-24 bg-brand-gold/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-brand-gold/20">
              <span className="text-3xl font-serif text-brand-gold font-bold">
                {user?.name.charAt(0).toUpperCase()}
              </span>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" required
                  placeholder="Seu Nome"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 focus:border-brand-gold outline-none transition-all"
                  value={profileName} onChange={e => setProfileName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">E-mail de Acesso</label>
                <input 
                  type="email" required
                  placeholder="seu@email.com"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 focus:border-brand-gold outline-none transition-all"
                  value={profileEmail} onChange={e => setProfileEmail(e.target.value)}
                />
              </div>

              <div className="pt-6">
                <button 
                  type="submit" disabled={isLoading}
                  className="w-full bg-brand-gold text-black py-4 rounded-2xl font-bold hover:bg-white transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)] flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "Salvar Alterações"
                  )}
                </button>
              </div>
            </form>

            <div className="mt-10 pt-10 border-t border-white/5 flex justify-center">
              <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-sm font-medium flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Encerrar Sessão
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-black text-white">
      {showSaveModal && <SaveModal />}
      {downloadStatus && <Notification />}
      
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
                  type="text" 
                  placeholder="Ex: Franz Co."
                  className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none"
                  value={currentProject.identity.name} onChange={e => updateProject({ identity: { ...currentProject.identity, name: e.target.value }})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-brand-400 font-medium">Slogan</label>
                <input 
                  type="text" 
                  placeholder="Ex: Excelência em cada detalhe"
                  className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none"
                  value={currentProject.identity.slogan} onChange={e => updateProject({ identity: { ...currentProject.identity, slogan: e.target.value }})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-brand-400 font-medium">Segmento</label>
              <input 
                type="text" 
                placeholder="Ex: Consultoria de Luxo"
                className="w-full bg-brand-800 border border-white/10 rounded-xl p-4 focus:border-brand-gold outline-none"
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
          title="Cores & Tipografia" subtitle="Damos vida à sua identidade visual."
          stepNumber={3} totalSteps={5} onBack={handlePrevStep} onNext={handleNextStep}
          isLoading={isLoading}
        >
          <div className="space-y-10">
            <div className="bg-brand-800/30 border border-white/10 p-8 rounded-3xl space-y-6">
              <h3 className="text-xl font-bold font-serif flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
                Refinar Paleta de Cores
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">Cores que você ama</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Azul marinho, Dourado, Bege"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 focus:border-brand-gold outline-none text-sm transition-all"
                    value={currentProject.identity.colorPreferences}
                    onChange={e => updateProject({ identity: { ...currentProject.identity, colorPreferences: e.target.value }})}
                  />
                  <p className="text-[10px] text-brand-500">A IA tentará incorporar essas preferências nas sugestões.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-brand-400 uppercase tracking-widest">Cores que você odeia</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Vermelho berrante, Neon, Rosa"
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 focus:border-brand-gold outline-none text-sm transition-all"
                    value={currentProject.identity.excludedColors}
                    onChange={e => updateProject({ identity: { ...currentProject.identity, excludedColors: e.target.value }})}
                  />
                  <p className="text-[10px] text-brand-500 italic text-red-400/60">A IA excluirá rigorosamente essas cores das paletas.</p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={handleRegeneratePalettes} 
                  disabled={isRegeneratingPalettes}
                  className="flex items-center gap-2 bg-brand-gold/10 text-brand-gold hover:bg-brand-gold hover:text-black px-6 py-2 rounded-full text-sm font-bold transition-all border border-brand-gold/20"
                >
                  {isRegeneratingPalettes ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Recalcular Sugestões
                </button>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="text-xl font-bold border-l-2 border-brand-gold pl-4">Opções Geradas</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {currentProject.brandingKit?.palettes.map((palette, pIdx) => (
                  <button
                    key={pIdx} 
                    onClick={() => updateProject({ brandingKit: { ...currentProject.brandingKit!, colors: palette }})}
                    className={`bg-brand-800/30 border p-5 rounded-[2rem] transition-all group ${JSON.stringify(currentProject.brandingKit?.colors) === JSON.stringify(palette) ? 'border-brand-gold bg-brand-gold/5 ring-1 ring-brand-gold/20' : 'border-white/10 hover:border-white/20'}`}
                  >
                    <div className="flex h-16 rounded-2xl overflow-hidden mb-4 shadow-xl">
                      {palette.map((c, idx) => <div key={idx} className="flex-grow h-full" style={{ backgroundColor: c }} title={c} />)}
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-bold text-brand-400 group-hover:text-white transition-colors">OPÇÃO {pIdx + 1}</span>
                      {JSON.stringify(currentProject.brandingKit?.colors) === JSON.stringify(palette) && (
                        <div className="w-2 h-2 rounded-full bg-brand-gold shadow-[0_0_8px_rgba(212,175,55,1)]" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-brand-800/30 border border-white/10 p-8 rounded-3xl">
              <span className="text-xs font-bold text-brand-gold uppercase tracking-widest block mb-2">Tipografia Recomendada</span>
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
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {currentProject.generatedLogos.map((logo) => (
                <div key={logo.id} className="flex flex-col gap-4">
                  <button
                    onClick={() => updateProject({ selectedLogoId: logo.id })}
                    className={`relative bg-white p-4 rounded-3xl border-4 transition-all overflow-hidden ${currentProject.selectedLogoId === logo.id ? 'border-brand-gold scale-[1.02] shadow-[0_0_40px_rgba(212,175,55,0.2)]' : 'border-transparent'}`}
                  >
                    <img src={logo.url} alt="Logo" className="w-full aspect-square object-contain" />
                  </button>
                  <button onClick={() => setVisiblePromptId(visiblePromptId === logo.id ? null : logo.id)} className="text-xs text-brand-400 underline self-start">
                    {visiblePromptId === logo.id ? 'Ocultar Prompt' : 'Ver Prompt'}
                  </button>
                  {visiblePromptId === logo.id && <p className="text-[10px] text-brand-500 italic">"{logo.prompt}"</p>}
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-10 text-center">
              <div className="inline-block relative">
                <button 
                  onClick={() => setShowEditOptions(!showEditOptions)}
                  className="bg-brand-800 border border-white/20 text-white px-8 py-3 rounded-full font-bold hover:border-brand-gold transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Editar Parâmetros do Projeto
                </button>
                
                {showEditOptions && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 bg-brand-800 border border-white/10 rounded-2xl p-2 shadow-2xl w-64 z-50 animate-in fade-in slide-in-from-bottom-2">
                    <button 
                      onClick={() => updateProject({ step: 2 })}
                      className="w-full text-left p-4 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <div className="font-bold text-sm">Ajustar Estilo Visual</div>
                      <div className="text-[10px] text-brand-400">Voltar para a Etapa 2</div>
                    </button>
                    <div className="h-px bg-white/5 my-1" />
                    <button 
                      onClick={() => updateProject({ step: 3 })}
                      className="w-full text-left p-4 hover:bg-white/5 rounded-xl transition-colors"
                    >
                      <div className="font-bold text-sm">Ajustar Cores e Fontes</div>
                      <div className="text-[10px] text-brand-400">Voltar para a Etapa 3</div>
                    </button>
                  </div>
                )}
              </div>
              <p className="text-brand-500 text-xs mt-4">Caso as variações não atendam sua expectativa, você pode refinar o conceito ou a paleta.</p>
            </div>
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
              <div className="w-full md:w-1/2 bg-white rounded-3xl p-12 flex items-center justify-center border border-white/10">
                <img src={currentProject.generatedLogos.find(l => l.id === currentProject.selectedLogoId)?.url} alt="Final" className="w-full h-auto object-contain" />
              </div>
              <div className="w-full md:w-1/2 space-y-6">
                <div className="bg-brand-800/30 p-8 rounded-3xl border border-white/10 shadow-2xl">
                  <h4 className="font-bold text-xl mb-6 font-serif">Exportar Arquivos</h4>
                  
                  <div className="space-y-4">
                    <button 
                      onClick={() => handleDownloadLogo(currentProject.generatedLogos.find(l => l.id === currentProject.selectedLogoId)?.url, currentProject.identity.name)}
                      className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-brand-gold hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Baixar PNG (Fundo Transparente)
                    </button>

                    <button 
                      onClick={handleDownloadSvg}
                      disabled={isGeneratingSvg}
                      className="w-full py-4 bg-brand-gold/10 text-brand-gold border border-brand-gold/50 rounded-xl font-bold hover:bg-brand-gold hover:text-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingSvg ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Processando Vetores...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          Download Alta Resolução (SVG)
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-8 p-4 bg-black/40 rounded-xl border border-white/5">
                    <p className="text-xs text-brand-400 text-center leading-relaxed">
                      O formato SVG permite redimensionar sua marca para qualquer tamanho sem perda de qualidade, ideal para impressões, cartões e outdoors.
                    </p>
                  </div>
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
