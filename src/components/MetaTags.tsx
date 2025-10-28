import React, { useEffect } from 'react';

interface MetaTagsProps {
  title: string;
  description: string;
}

const MetaTags: React.FC<MetaTagsProps> = ({ title, description }) => {
  useEffect(() => {
    document.title = title;

    let metaDescriptionTag = document.querySelector('meta[name="description"]');
    if (!metaDescriptionTag) {
      metaDescriptionTag = document.createElement('meta');
      metaDescriptionTag.setAttribute('name', 'description');
      document.head.appendChild(metaDescriptionTag);
    }
    metaDescriptionTag.setAttribute('content', description);
  }, [title, description]);

  return null;
};

export default MetaTags;