import { PropsWithChildren } from 'react';
import { AppAuthBootstrap } from './_components/app-auth-bootstrap';

export default function AppLayout({ children }: PropsWithChildren) {
  return <AppAuthBootstrap>{children}</AppAuthBootstrap>;
}
