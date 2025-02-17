import { create } from 'zustand';

interface UserInfo {
    walletAddress: string | null;
    tokenBalance: number | null; 
}

interface UserStore {
    userInfo: UserInfo;
    setWalletAddress: (address: string) => void;
    setUserInfo: (info: UserInfo) => void;
}

export const useUserStore = create<UserStore>((set) => ({
    userInfo: { 
        walletAddress: null, 
        tokenBalance: null, 
    },
    setWalletAddress: (address) => set((state) => ({
        userInfo: { 
            ...state.userInfo,
            walletAddress: address 
        }
    })),
    setUserInfo: (info) => set({ userInfo: info }),
}));
