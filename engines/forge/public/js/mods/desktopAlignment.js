// Local desktop bundles already contain these files on their own loopback server.
// Synchronize them through the normal SHA-256 verifier before enabling Start.
export function shouldAutoAlignDesktop(plan, { userAgent = '', hostname = '' } = {}) {
  return /\bElectron\//.test(userAgent)
    && ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname)
    && plan?.needed === true && plan.ok !== true
    && Array.isArray(plan.unknown) && plan.unknown.length === 0;
}
