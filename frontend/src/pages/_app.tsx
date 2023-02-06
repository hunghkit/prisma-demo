import { apolloClient } from '@/services/client'
import { ApolloProvider } from '@apollo/client'
import type { AppProps } from 'next/app'

import "../styles/tailwind.css"

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ApolloProvider client={apolloClient}>
      <Component {...pageProps} />
    </ApolloProvider>
  );
}
