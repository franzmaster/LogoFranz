
export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
}

export interface BrandIdentity {
  name: string;
  slogan: string;
  segment: string;
  target: string;
  personality: string;
}

export type VisualStyleType = 'minimalist' | 'technological' | 'classic' | 'modern' | 'premium';
export type VisualPreference = 'symbol' | 'letter' | 'abstract';

export interface VisualStyle {
  style: VisualStyleType;
  preference: VisualPreference;
  inspiration?: string;
}

export interface BrandingKit {
  colors: string[];
  palettes: string[][];
  typography: {
    primary: string;
    secondary: string;
  };
}

export interface GeneratedLogo {
  id: string;
  url: string;
  prompt: string;
}

export interface LogoProject {
  id: string;
  userId: string;
  identity: BrandIdentity;
  visualStyle: VisualStyle;
  brandingKit?: BrandingKit;
  selectedLogoId?: string;
  generatedLogos: GeneratedLogo[];
  step: number;
}

export enum AppState {
  AUTH = 'AUTH',
  LANDING = 'LANDING',
  DASHBOARD = 'DASHBOARD',
  WIZARD = 'WIZARD',
}
