export const STAGE_INSPECTION_IMAGES: Record<string, string> = {
  KNITTING: '/images/knitting-inspection.jpg',
  DYEING_WASHING: '/images/labdip-navy.jpg',
  PRINTING: '/images/print-inspection.jpg',
  CUTTING: '/images/cutting-inspection.jpg',
  STITCHING: '/images/stitching-line.jpg',
  CHECKING: '/images/collar-inspection.jpg',
  FINISHING: '/images/finishing-packing.jpg',
  DEFAULT: '/images/collar-inspection.jpg',
};

export const getSafeImageUrl = (url?: string | null, stage?: string): string => {
  if (!url || typeof url !== 'string') {
    return STAGE_INSPECTION_IMAGES[stage || ''] || STAGE_INSPECTION_IMAGES.DEFAULT;
  }
  if (url.startsWith('data:')) return url;
  if (url.includes('collar-inspection')) return '/images/collar-inspection.jpg';
  if (url.includes('print-strike-off') || url.includes('print-inspection')) return '/images/print-inspection.jpg';
  if (url.includes('labdip-navy')) return '/images/labdip-navy.jpg';
  if (url.includes('stitching-line')) return '/images/stitching-line.jpg';
  if (url.includes('cutting-inspection')) return '/images/cutting-inspection.jpg';
  if (url.includes('finishing-packing')) return '/images/finishing-packing.jpg';
  if (url.includes('assets.threadflow.app')) {
    return STAGE_INSPECTION_IMAGES[stage || ''] || STAGE_INSPECTION_IMAGES.DEFAULT;
  }
  return url;
};

export const handleImageError = (
  e: React.SyntheticEvent<HTMLImageElement, Event>,
  stage?: string
) => {
  const target = e.currentTarget;
  target.onerror = null; // Prevent infinite loop
  target.src = STAGE_INSPECTION_IMAGES[stage || ''] || STAGE_INSPECTION_IMAGES.DEFAULT;
};
