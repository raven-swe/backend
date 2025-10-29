export function maskEmail(email: string | null | undefined): string {
  const fallbackMask = '*******';

  if (typeof email !== 'string' || email.length === 0) {
    return fallbackMask;
  }

  const atIndex = email.indexOf('@');
  if (atIndex <= 0) {
    return fallbackMask;
  }

  const localPart = email.substring(0, atIndex);
  const domainPart = email.substring(atIndex + 1);

  if (domainPart.length === 0) {
    return fallbackMask;
  }

  let maskedLocal: string;
  if (localPart.length === 1) {
    maskedLocal = '*';
  } else if (localPart.length === 2) {
    maskedLocal = localPart[0] + '*';
  } else if (localPart.length === 3) {
    maskedLocal = localPart.slice(0, 2) + '*';
  } else {
    maskedLocal = localPart.slice(0, 3) + '*'.repeat(localPart.length - 3);
  }

  const domainParts = domainPart.split('.');

  if (domainParts.some((part) => part.length === 0) || domainParts.length < 2) {
    return `${maskedLocal}@${fallbackMask}`;
  }

  const maskedDomainParts = domainParts.map((part) => {
    if (part.length === 1) {
      return '*';
    }
    return part[0] + '*'.repeat(part.length - 1);
  });

  return `${maskedLocal}@${maskedDomainParts.join('.')}`;
}
