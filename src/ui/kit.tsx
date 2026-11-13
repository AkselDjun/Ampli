import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export const cx = (...parts: (string | false | null | undefined)[]): string => parts.filter(Boolean).join(' ');

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

export function DataTable({ label, className, head, foot, children }: { label: string; className?: string; head: ReactNode; foot?: ReactNode; children: ReactNode }) {
  return (
    <div className="tablewrap dt-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className={cx('dt', className)}>
        <thead><tr>{head}</tr></thead>
        <tbody>{children}</tbody>
        {foot && <tfoot>{foot}</tfoot>}
      </table>
    </div>
  );
}

export function MoneyInput({ className, ...rest }: ComponentProps<'input'>) {
  return (
    <span className={cx('money-in', className)}>
      <input className="price-in" type="text" inputMode="decimal" {...rest} />
      <span className="money-u" aria-hidden="true">BYN</span>
    </span>
  );
}
