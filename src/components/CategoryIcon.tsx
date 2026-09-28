import React from 'react';
import {
  Utensils,
  Home,
  Car,
  HeartPulse,
  Tv,
  ShoppingBag,
  GraduationCap,
  Briefcase,
  TrendingUp,
  ArrowDownLeft,
  Tag,
  Target,
  Coffee,
  Plane,
  Gift,
  Zap,
  Smartphone,
  BookOpen,
  Dumbbell,
  Shield,
  Smile,
  CircleDollarSign,
  Cookie,
  ArrowLeftRight,
  Stethoscope,
  Pill,
  Sparkles,
} from 'lucide-react';

interface Props {
  categoryId: string;
  iconName?: string;
  className?: string;
}

export const CategoryIcon: React.FC<Props> = ({ categoryId, iconName, className = 'w-4 h-4' }) => {
  const key = (iconName || categoryId || '').toLowerCase();

  switch (key) {
    case 'alimentacao':
    case 'utensils':
    case 'food':
      return <Utensils className={className} />;
    case 'moradia':
    case 'home':
    case 'house':
      return <Home className={className} />;
    case 'contas':
    case 'zap':
    case 'utilities':
    case 'energia':
      return <Zap className={className} />;
    case 'transporte':
    case 'car':
      return <Car className={className} />;
    case 'saude':
    case 'medico':
    case 'stethoscope':
    case 'estetoscopio':
      return <Stethoscope className={className} />;
    case 'farmacia':
    case 'pill':
    case 'medicamento':
    case 'heartpulse':
    case 'heart':
      return <HeartPulse className={className} />;
    case 'snacks':
    case 'snack':
    case 'cookie':
      return <Cookie className={className} />;
    case 'transacao_interna':
    case 'transferencia':
    case 'arrowleftright':
      return <ArrowLeftRight className={className} />;
    case 'lazer':
    case 'sparkles':
    case 'saidas':
    case 'saídas':
      return <Sparkles className={className} />;
    case 'servicos':
    case 'assinaturas':
    case 'tv':
    case 'streaming':
      return <Tv className={className} />;
    case 'compras':
    case 'shoppingbag':
    case 'cart':
      return <ShoppingBag className={className} />;
    case 'educacao':
    case 'graduationcap':
    case 'book':
      return <GraduationCap className={className} />;
    case 'briefcase':
      return <Briefcase className={className} />;
    case 'investimentos':
    case 'trendingup':
      return <TrendingUp className={className} />;
    case 'receitas':
    case 'arrowdownleft':
      return <ArrowDownLeft className={className} />;
    case 'coffee':
    case 'cafe':
      return <Coffee className={className} />;
    case 'plane':
    case 'viagem':
      return <Plane className={className} />;
    case 'gift':
    case 'presente':
      return <Gift className={className} />;
    case 'zap':
    case 'energia':
      return <Zap className={className} />;
    case 'smartphone':
    case 'celular':
      return <Smartphone className={className} />;
    case 'dumbbell':
    case 'academia':
      return <Dumbbell className={className} />;
    case 'shield':
    case 'seguro':
      return <Shield className={className} />;
    case 'target':
    case 'meta':
      return <Target className={className} />;
    case 'smile':
      return <Smile className={className} />;
    case 'dollar':
    case 'circledollarsign':
      return <CircleDollarSign className={className} />;
    case 'outros':
    case 'tag':
    default:
      return <Tag className={className} />;
  }
};

