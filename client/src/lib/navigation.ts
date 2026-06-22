export function getDomainLinks() {
  if (typeof window === "undefined") {
    return {
      vaxplanUrl: "https://vaxplan.org",
      docsUrl: "https://docs.vaxplan.org",
      researchUrl: "https://research.vaxplan.org",
    };
  }

  const protocol = window.location.protocol;
  const host = window.location.host;
  
  // Extract base domain by removing doc., docs., research., reasearch. prefixes
  const baseHost = host.replace(/^(doc|docs|research|reasearch)\./, "");
  
  return {
    vaxplanUrl: `${protocol}//${baseHost}`,
    docsUrl: `${protocol}//doc.${baseHost}`,
    researchUrl: `${protocol}//research.${baseHost}`,
  };
}
