
import React from 'react';

interface StepLayoutProps {
  title: string;
  subtitle: string;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  nextDisabled?: boolean;
  isLoading?: boolean;
  children: React.ReactNode;
}

const StepLayout: React.FC<StepLayoutProps> = ({
  title,
  subtitle,
  stepNumber,
  totalSteps,
  onNext,
  onBack,
  nextDisabled,
  isLoading,
  children
}) => {
  const progress = (stepNumber / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-black flex flex-col pt-20">
      <div className="fixed top-0 left-0 w-full h-1 bg-brand-800 z-50">
        <div 
          className="h-full bg-brand-gold transition-all duration-500" 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="max-w-4xl mx-auto w-full px-6 flex-grow pb-32">
        <div className="mb-12">
          <span className="text-brand-gold text-sm font-bold tracking-widest uppercase mb-2 block">
            Etapa {stepNumber} de {totalSteps}
          </span>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-white mb-4">
            {title}
          </h1>
          <p className="text-brand-400 text-lg">
            {subtitle}
          </p>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-black/80 backdrop-blur-md border-t border-white/10 py-6 z-40">
        <div className="max-w-4xl mx-auto px-6 flex justify-between items-center">
          <button
            onClick={onBack}
            className="px-8 py-3 text-brand-400 hover:text-white transition-colors"
            disabled={stepNumber === 1 || isLoading}
          >
            Voltar
          </button>
          <button
            onClick={onNext}
            disabled={nextDisabled || isLoading}
            className="bg-white text-black hover:bg-brand-gold hover:text-white px-12 py-3 rounded-full font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Processando...
              </>
            ) : (
              stepNumber === 5 ? 'Finalizar' : 'Continuar'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StepLayout;
