type Subscription = { starts_at?: string | null; ends_at?: string | null; status?: string | null };
export function subscriptionState(subscription: Subscription | null | undefined, institutionActive = true, now = new Date()) {
  const end = subscription?.ends_at ? new Date(subscription.ends_at).getTime() : NaN;
  const start = subscription?.starts_at ? new Date(subscription.starts_at).getTime() : NaN;
  const configured = !!subscription && Number.isFinite(end) && Number.isFinite(start);
  const validStatus = ['active','trialing'].includes(subscription?.status || '');
  const isExpired = !institutionActive || !configured || !validStatus || start>now.getTime() || end<=now.getTime();
  const daysLeft = configured ? Math.ceil((end-now.getTime())/86400000) : null;
  return { isExpired, daysLeft, isCritical:!isExpired && daysLeft!==null && daysLeft<=1, isWarning:!isExpired && daysLeft!==null && daysLeft>1 && daysLeft<=7 };
}
