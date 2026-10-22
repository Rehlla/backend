import { useEffect } from 'react';

/**
 * useSEO — Manages document meta tags from CMS SEO data.
 * 
 * Usage:
 *   useSEO({
 *     title: 'About Dahab',
 *     description: 'Learn about Dahab travel platform',
 *     ogTitle: 'About Dahab',
 *     ogDescription: 'Learn about Dahab travel platform',
 *     ogImage: 'https://example.com/image.jpg',
 *     canonical: 'https://dahabtravel.com/about',
 *     noindex: false,
 *   });
 * 
 * Sets document.title, meta tags, and Open Graph tags.
 * Restores original values on unmount.
 */

interface SEOData {
  title?: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
}

function setMetaTag(property: string, content: string): void {
  if (!content) return;
  
  // Check if tag already exists
  let tag = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
  if (!tag) {
    tag = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
  }
  
  if (!tag) {
    tag = document.createElement('meta');
    if (property.startsWith('og:') || property.startsWith('article:')) {
      tag.setAttribute('property', property);
    } else {
      tag.setAttribute('name', property);
    }
    document.head.appendChild(tag);
  }
  
  tag.setAttribute('content', content);
}

function removeMetaTag(property: string): void {
  const tag = document.querySelector(`meta[property="${property}"]`) ||
              document.querySelector(`meta[name="${property}"]`);
  if (tag) {
    tag.remove();
  }
}

export function useSEO(data: SEOData): void {
  useEffect(() => {
    const prevTitle = document.title;
    
    // Store original meta tags for cleanup
    const prevTags: Array<{ attr: string; value: string; element: HTMLMetaElement }> = [];
    
    const tagNames = ['description', 'og:title', 'og:description', 'og:image', 'og:url', 'robots'];
    for (const name of tagNames) {
      const existing = document.querySelector(`meta[property="${name}"]`) ||
                       document.querySelector(`meta[name="${name}"]`);
      if (existing) {
        prevTags.push({
          attr: name.startsWith('og:') ? 'property' : 'name',
          value: existing.getAttribute(existing.hasAttribute('property') ? 'property' : 'name') || name,
          element: existing as HTMLMetaElement,
        });
      }
    }

    // Set new values
    if (data.title) {
      document.title = `${data.title} · REHLA`;
    }
    
    if (data.description) {
      setMetaTag('description', data.description);
    }
    
    if (data.ogTitle) {
      setMetaTag('og:title', data.ogTitle);
    }
    
    if (data.ogDescription) {
      setMetaTag('og:description', data.ogDescription);
    }
    
    if (data.ogImage) {
      setMetaTag('og:image', data.ogImage);
    }
    
    if (data.canonical) {
      setMetaTag('og:url', data.canonical);
      
      // Update or create canonical link
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
      if (!canonicalLink) {
        canonicalLink = document.createElement('link');
        canonicalLink.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalLink);
      }
      canonicalLink.setAttribute('href', data.canonical);
    }
    
    if (data.noindex) {
      setMetaTag('robots', 'noindex, nofollow');
    }

    // Cleanup: restore original values
    return () => {
      document.title = prevTitle;
      
      removeMetaTag('description');
      removeMetaTag('og:title');
      removeMetaTag('og:description');
      removeMetaTag('og:image');
      removeMetaTag('og:url');
      removeMetaTag('robots');
      
      const canonicalLink = document.querySelector('link[rel="canonical"]');
      if (canonicalLink) {
        canonicalLink.remove();
      }
    };
  }, [data.title, data.description, data.ogTitle, data.ogDescription, data.ogImage, data.canonical, data.noindex]);
}
