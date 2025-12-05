import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { celoAlfajores, celo } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SafeDrive AI',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains: [celoAlfajores, celo],
  ssr: true,
});
