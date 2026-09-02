import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { IntentionArea } from '@/services/intentions/intentionsStorage.types';

export const INTENTION_AREAS: {
    id: IntentionArea;
    label: string;
    icon: keyof typeof MaterialIcons.glyphMap;
    color: string;
}[] = [
    { id: 'wellbeing', label: 'Wellbeing', icon: 'favorite', color: '#F472B6' },
    { id: 'career', label: 'Career', icon: 'work', color: '#D97706' },
    { id: 'finances', label: 'Finances', icon: 'payments', color: '#10B981' },
    { id: 'family', label: 'Family', icon: 'group', color: '#60A5FA' },
    { id: 'romance', label: 'Romance', icon: 'favorite-border', color: '#FB7185' },
    { id: 'community', label: 'Community', icon: 'handshake', color: '#FACC15' },
    { id: 'recreation', label: 'Recreation', icon: 'directions-bike', color: '#818CF8' },
    { id: 'environment', label: 'Environment', icon: 'home', color: '#14B8A6' },
    { id: 'spirituality', label: 'Spirituality', icon: 'self-improvement', color: '#A78BFA' },
];

export function getIntentionAreaConfig(area: IntentionArea) {
    return INTENTION_AREAS.find((item) => item.id === area);
}
