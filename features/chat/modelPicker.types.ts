export interface ChatModelOption {
    readonly id: string;
    readonly name?: string;
    readonly publicId?: string;
    readonly contextWindow: number;
    readonly availability?: 'available' | 'degraded' | 'unavailable';
}
