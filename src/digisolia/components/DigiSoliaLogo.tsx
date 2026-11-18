import React, { useState } from 'react';
import { DIGISOLIA_CONFIG } from '../config/digisolia.config';

interface DigiSoliaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSignature?: boolean;
  appAccent?: string;
  darkSurface?: boolean;
}

export const DigiSoliaLogo: React.FC<DigiSoliaLogoProps> = ({
  size = 'md',
  showSignature = false,
  appAccent,
  darkSurface = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const logoImg = DIGISOLIA_CONFIG.logo.imageUrl;

  const boxSizes = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-12 h-12 rounded-xl',
  };

  const titleSizes = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  return (
    <div className="inline-flex items-center gap-3 select-none">
      {logoImg && !imgError ? (
        <img
          src={logoImg}
          alt={DIGISOLIA_CONFIG.brandName}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className={`${boxSizes[size]} object-contain shrink-0`}
        />
      ) : (
        <div
          className={`${boxSizes[size]} flex items-center justify-center shrink-0 border`}
          style={{
            backgroundColor: DIGISOLIA_CONFIG.colors.primary,
            borderColor: DIGISOLIA_CONFIG.colors.secondary,
          }}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 32 32"
            fill="none"
            className="w-3/5 h-3/5"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 6H16.5C21.7467 6 26 10.2533 26 15.5C26 20.7467 21.7467 25 16.5 25H7V6Z"
              stroke="#FFFFFF"
              strokeWidth="2.75"
              strokeLinejoin="round"
            />
            <path
              d="M12.5 11.5H16.5C18.7091 11.5 20.5 13.2909 20.5 15.5C20.5 17.7091 18.7091 19.5 16.5 19.5H12.5V11.5Z"
              fill={DIGISOLIA_CONFIG.colors.secondary}
            />
          </svg>
        </div>
      )}

      <div className="flex flex-col leading-tight">
        <div className={`font-extrabold tracking-tight flex items-baseline gap-1.5 ${titleSizes[size]}`}>
          <span className={darkSurface ? 'text-white' : 'text-[#163B65] dark:text-white'}>
            {DIGISOLIA_CONFIG.logo.text}
          </span>
          {(appAccent || DIGISOLIA_CONFIG.logo.accentText) && (
            <span className="font-bold text-[#2783C7] dark:text-sky-400">
              {appAccent ?? DIGISOLIA_CONFIG.logo.accentText}
            </span>
          )}
        </div>
        {showSignature && (
          <span
            className={`text-xs font-medium mt-0.5 ${
              darkSurface ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {DIGISOLIA_CONFIG.brandSignature}
          </span>
        )}
      </div>
    </div>
  );
};
