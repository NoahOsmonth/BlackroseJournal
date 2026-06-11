import {
    Bicycle,
    Briefcase,
    Butterfly,
    Handshake,
    Heart,
    HeartStraight,
    HouseLine,
    Money,
    UsersThree,
} from 'phosphor-react-native';
import { IntentionArea } from '@/services/intentions/intentionsStorage.types';

export const INTENTION_AREAS: {
    id: IntentionArea;
    label: string;
    icon: typeof Heart;
    color: string;
}[] = [
    { id: 'wellbeing', label: 'Wellbeing', icon: Heart, color: '#F472B6' },
    { id: 'career', label: 'Career', icon: Briefcase, color: '#D97706' },
    { id: 'finances', label: 'Finances', icon: Money, color: '#10B981' },
    { id: 'family', label: 'Family', icon: UsersThree, color: '#60A5FA' },
    { id: 'romance', label: 'Romance', icon: HeartStraight, color: '#FB7185' },
    { id: 'community', label: 'Community', icon: Handshake, color: '#FACC15' },
    { id: 'recreation', label: 'Recreation', icon: Bicycle, color: '#818CF8' },
    { id: 'environment', label: 'Environment', icon: HouseLine, color: '#14B8A6' },
    { id: 'spirituality', label: 'Spirituality', icon: Butterfly, color: '#A78BFA' },
];

export function getIntentionAreaConfig(area: IntentionArea) {
    return INTENTION_AREAS.find((item) => item.id === area);
}
