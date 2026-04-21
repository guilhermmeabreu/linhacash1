'use client';

import * as React from 'react';
import { cn } from '@/lib/ui/cn';

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within <TabsRoot>.');
  }
  return context;
}

interface TabsRootProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

export function TabsRoot({ value, defaultValue = '', onValueChange, className, ...props }: TabsRootProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const activeValue = value ?? internalValue;

  const setValue = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [onValueChange, value],
  );

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      <div className={cn('lc-tabs', className)} {...props} />
    </TabsContext.Provider>
  );
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn('lc-tabs-list', className)} {...props} />;
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function TabsTrigger({ className, value, ...props }: TabsTriggerProps) {
  const tabs = useTabsContext();
  const isActive = tabs.value === value;
  const { onClick, ...restProps } = props;

  const handleClick = React.useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    tabs.setValue(value);
  }, [onClick, tabs, value]);

  return (
    <button
      role="tab"
      aria-selected={isActive}
      type="button"
      className={cn('lc-tab-trigger', isActive && 'is-active', className)}
      onClick={handleClick}
      {...restProps}
    />
  );
}

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabsContent({ className, value, ...props }: TabsContentProps) {
  const tabs = useTabsContext();
  if (tabs.value !== value) return null;
  return <div role="tabpanel" className={cn('lc-tab-content', className)} {...props} />;
}
