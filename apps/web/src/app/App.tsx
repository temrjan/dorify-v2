import { Providers } from './providers';
import { AppRouter } from './router';
import { Layout } from './Layout';

export function App() {
  return (
    <Providers>
      <Layout>
        <AppRouter />
      </Layout>
    </Providers>
  );
}
