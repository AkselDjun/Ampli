import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

export const buttonClass = (variant: ButtonVariant = 'default', size: ButtonSize = 'md', extra?: string): string =>
  cx('btn', variant !== 'default' && variant, size === 'sm' && 'sm', extra);

export function Button({
  variant = 'default', size = 'md', className, type = 'button', ...rest
}: ComponentProps<'button'> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}

export function IconButton({
  label, tip, className, type = 'button', ...rest
}: Omit<ComponentProps<'button'>, 'aria-label'> & { label: string; tip?: string }) {
  return <button type={type} className={cx('icon-btn', className)} aria-label={label} data-tip={tip} {...rest} />;
}

export function Field({
  id, label, hint, wide, className, children
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  wide?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('f', wide && 'wide', className)}>
      <label className="lbl" htmlFor={id}>{label}</label>
      {children}
      {hint && <small>{hint}</small>}
    </div>
  );
}
