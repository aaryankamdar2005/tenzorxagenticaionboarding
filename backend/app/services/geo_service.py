"""
Geo-fencing service: compares browser GPS coords with IP geolocation.
Uses ip-api.com (free, no API key needed) for IP resolution.
Flags sessions where GPS-to-IP distance > 100km (potential VPN usage).
"""
from __future__ import annotations

import logging
import math

import httpx

from app.models.schemas import GeoVerification

logger = logging.getLogger(__name__)

_IP_API_URL = "http://ip-api.com/json/{ip}?fields=lat,lon,status,message"


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return great-circle distance in km between two (lat, lon) points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def verify_geo(
    client_ip: str,
    gps_lat: float | None,
    gps_lng: float | None,
    mismatch_threshold_km: float = 100.0,
) -> GeoVerification:
    """
    Resolve IP to coordinates and compare with GPS.
    Returns GeoVerification with is_mismatch=True if distance > threshold.
    """
    result = GeoVerification(
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        ip_address=client_ip,
    )

    # Skip private/loopback IPs in dev
    if not client_ip or client_ip in ("127.0.0.1", "::1", "localhost"):
        logger.info("Skipping geo check for loopback IP")
        return result

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(_IP_API_URL.format(ip=client_ip))
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "success":
                logger.warning("ip-api.com returned non-success: %s", data.get("message"))
                return result

            ip_lat = float(data["lat"])
            ip_lng = float(data["lon"])
            result.ip_lat = ip_lat
            result.ip_lng = ip_lng

            if gps_lat is not None and gps_lng is not None:
                dist = _haversine_km(gps_lat, gps_lng, ip_lat, ip_lng)
                result.distance_km = round(dist, 2)
                result.is_mismatch = dist > mismatch_threshold_km
                if result.is_mismatch:
                    logger.warning(
                        "Geo mismatch detected: GPS=(%.4f,%.4f) IP=(%.4f,%.4f) dist=%.1fkm",
                        gps_lat, gps_lng, ip_lat, ip_lng, dist,
                    )
    except Exception as exc:
        logger.warning("Geo verification failed: %s", exc)

    return result
