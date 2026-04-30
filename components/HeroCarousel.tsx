"use client";

import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import type { ContentListItem } from "@/lib/types";
import { contentThumb } from "@/lib/utils";

export function HeroCarousel({ items }: { items: ContentListItem[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    const id = setInterval(() => emblaApi.scrollNext(), 6000);
    return () => {
      emblaApi.off("select", onSelect);
      clearInterval(id);
    };
  }, [emblaApi, onSelect]);

  if (!items.length) return null;

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {items.map((item, i) => {
            const href = `/${item.CatSeo}/${item.ContentSeo}`;
            const image = contentThumb(item.ContentImage) || "/Upload/default-cover.jpg";
            return (
              <div key={item.ContentID} className="relative min-w-0 flex-[0_0_100%]">
                <Link href={href} className="group block">
                  <div className="relative aspect-[16/10] w-full bg-neutral-200">
                    <Image
                      src={image}
                      alt={item.ContentTitle}
                      fill
                      priority={i === 0}
                      sizes="(min-width: 1024px) 760px, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 md:p-7">
                    <span className="inline-block rounded bg-brand/90 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                      {item.CatName}
                    </span>
                    <h2 className="mt-2 max-w-3xl text-xl font-bold leading-tight text-white md:text-2xl lg:text-3xl">
                      {item.ContentTitle}
                    </h2>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={`h-1.5 w-8 rounded-full transition-colors ${
              i === selected ? "bg-white" : "bg-white/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
