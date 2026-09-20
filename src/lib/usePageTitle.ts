import { useEffect } from 'react';
import { SERVICE_NAME } from '../config';

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · ${SERVICE_NAME}`;
  }, [title]);
}
