import React, { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import { getProperties } from '../services/wordpress';
import { Property } from '../types';

const ServiceMap: React.FC = () => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);

  // Fetch properties once and keep the map alive between updates.
  useEffect(() => {
    let isMounted = true;

    getProperties().then(data => {
      if (isMounted) setProperties(data);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current).setView([39.05, -74.78], 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(mapRef.current);

    markersLayerRef.current = L.layerGroup().addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current || properties.length === 0) return;

    markersLayerRef.current.clearLayers();

    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: #0f172a; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
      popupAnchor: [0, -10]
    });

    properties.forEach((prop) => {
      const marker = L.marker([prop.coordinates.lat, prop.coordinates.lng], { icon: customIcon })
        .bindPopup(`
          <div class="font-sans">
            <div class="relative h-32 w-full">
              <img src="${prop.imageUrl}" class="w-full h-full object-cover" style="display:block; width: 260px; height: 130px;" />
              <div class="absolute top-0 left-0 bg-[#0f172a] text-[#c0a062] text-[10px] font-bold px-2 py-1 uppercase">${prop.category}</div>
            </div>
            <div class="p-3">
              <div class="font-bold text-lg text-[#0f172a]">$${prop.price?.toLocaleString()}</div>
              <div class="font-serif text-sm text-slate-700">${prop.address}</div>
              <div class="text-xs text-slate-500 mb-2">${prop.city}, NJ</div>
              <div class="flex gap-2">
                 <a href="#/portfolio/${prop.id}" class="flex-1 text-center py-1 px-2 rounded bg-slate-100 text-xs font-bold text-slate-700 uppercase hover:bg-slate-200">View Album</a>
                 ${prop.listingUrl ? `<a href="${prop.listingUrl}" target="_blank" class="flex-1 text-center py-1 px-2 rounded bg-brand-gold/20 text-xs font-bold text-[#c0a062] uppercase hover:bg-brand-gold/30">View Listing</a>` : ''}
              </div>
            </div>
          </div>
        `);

      marker.on('mouseover', () => marker.openPopup());
      marker.addTo(markersLayerRef.current!);
    });
  }, [properties]);

  return (
    <div className="relative w-full h-[600px] bg-slate-100 rounded-xl overflow-hidden shadow-xl border border-slate-200 z-0">
      <div ref={mapContainerRef} className="w-full h-full" />
      <div className="absolute bottom-4 left-4 z-[400] bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-md text-xs">
        <span className="font-bold text-brand-900">Interactive Map:</span> Hover over pins to see properties.
      </div>
    </div>
  );
};

export default ServiceMap;
