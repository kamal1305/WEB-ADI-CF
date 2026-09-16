#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extracción de datos RFAF -> contenido web A.D. Icovesa (temporadas 2025/26 y 2026/27).

Pipeline:
  1. Sesión HTTP con warm-up (la RFAF sirve páginas vacías si no se arranca desde el home).
  2. Descarga/parseo de las clasificaciones FINALES 2025-26 de cada equipo federado
     (ficheros de trabajo en rfaf/dat/, encoding ISO-8859-15).
  3. Descarga de las jornadas 1 y 2 de la temporada 2026-27 para los equipos registrados
     (Alevín A/B, Infantil, Prebenjamín A y Bebés) -> próximos partidos.
  4. Normalización de acentos y escritura en UTF-8 de content/equipos.json y
     content/calendario.json, conservando el esquema que consume index.html.

Notas:
  - El decoding de las páginas de trabajo SIEMPRE es ISO-8859-15 (charset real de la RFAF).
  - Los JSON de salida son UTF-8.
  - Temporadas: la RFAF usa código 21 = 2025-26 y 22 = 2026-27.
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

# ----------------------------------------------------------------------------- constantes
URL_HOME = "https://www.rfaf.es"
URL_CLASIFICACION = (
    "https://www.rfaf.es/pnfg/NPcd/NFG_VisClasificacion"
    "?cod_primaria=1000120&codcompeticion={comp}&codgrupo={grupo}"
)
URL_JORNADA = (
    "https://www.rfaf.es/pnfg/NPcd/NFG_CmpJornada"
    "?cod_primaria=1000120&CodTemporada=22&CodGrupo={grupo}"
    "&CodCompeticion={comp}&CodJornada={jornada}"
)
URL_GRUPO_EQUIPO = (
    "https://www.rfaf.es/pnfg/NPcd/NFG_VisCompeticiones_Grupo"
    "?cod_primaria=1000123&codequipo={equipo}&codgrupo={grupo}"
)

HEADERS_UA = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        " (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    )
}

RAIZ = Path(__file__).resolve().parent          # rfaf/
DIR_DAT = RAIZ / "dat"                          # ficheros de trabajo (html crudo)
RAIZ_REPO = RAIZ.parent                         # raíz del repo
JSON_EQUIPOS = RAIZ_REPO / "content" / "equipos.json"
JSON_CALENDARIO = RAIZ_REPO / "content" / "calendario.json"

PAUSA_ENTRE_PETICIONES_S = 2.0   # throttle de la RFAF
REINTENTOS = 3


@dataclass(frozen=True)
class Equipo2025:
    """Equipo federado del club con su grupo de clasificación 2025-26."""
    categoria: str            # categoría del portal (clave en equipos.json)
    nombre: str               # nombre del equipo en la web A.D. Icovesa
    codigo_equipo: str
    competicion: str          # codcompeticion 2025-26
    grupo: str                # codgrupo 2025-26
    categoria_federada: str


@dataclass(frozen=True)
class Equipo2026:
    """Equipo del club registrado en la temporada 2026-27."""
    categoria: str
    equipo_rfaf: str          # código de equipo en la RFAF
    competicion: str          # codcompeticion 2026-27
    grupo: str                # codgrupo 2026-27


EQUIPOS_2025: tuple[Equipo2025, ...] = (
    Equipo2025("Bebés", "A.D. Icovesa", "14747812", "47320150", "47320163", "2ª ANDALUZA BEBE (CADIZ)"),
    Equipo2025("Prebenjamín", "A.D. Icovesa A", "349917", "46560292", "46630645", "3ª ANDALUZA PREBENJAMIN"),
    Equipo2025("Prebenjamín", "A.D. Icovesa B", "28658193", "46560292", "46631113", "3ª ANDALUZA PREBENJAMIN"),
    Equipo2025("Benjamín", "A.D. Icovesa", "33424766", "46271051", "46360123", "4ª ANDALUZA BENJAMIN"),
    Equipo2025("Benjamín", "A.D. Icovesa B", "2073084", "30765606", "30771371", "4ª ANDALUZA BENJAMIN"),
    Equipo2025("Alevín", "A.D. Icovesa A", "10114506", "46125067", "46213561", "4ª ANDALUZA ALEVIN"),
    Equipo2025("Alevín", "A.D. Icovesa B", "2856275", "41338698", "41447000", "4ª ANDALUZA ALEVIN"),
    Equipo2025("Infantil", "A.D. Icovesa", "13252190", "45931674", "46084358", "4ª ANDALUZA INFANTIL"),
)

# Solo los equipos registrados en 2026-27 con calendario ya publicado.
# (Benjamín A, Benjamín B y Prebenjamín B NO se inscribieron; el Bebés
#  aparece en el TORNEO BEBE IFECA pero su cuadro aún muestra jornadas pasadas).
EQUIPOS_2026: tuple[Equipo2026, ...] = (
    Equipo2026("Alevín", "10114506", "49608278", "49795797"),      # 4ª ANDALUZA ALEVIN (CADIZ) Gº9
    Equipo2026("Alevín", "2856275", "49608278", "49796446"),       # 4ª ANDALUZA ALEVIN (CADIZ) Gº10
    Equipo2026("Infantil", "13252190", "49505530", "49603909"),    # 4ª ANDALUZA INFANTIL (CADIZ) Gº7
    Equipo2026("Prebenjamín", "349917", "10045016", "10229441"),   # 2ª ANDALUZA PREBENJAMIN (CADIZ) Gº5
)

JORNADAS_2026_A_EXTRAER = (1, 2)   # 2 próximas jornadas por equipo

# Registro 2026-27 legible (para equipos.json) clave por codigo_equipo.
REGISTRO_2026_27: dict[str, str] = {
    "10114506": "4ª ANDALUZA ALEVIN (CADIZ) · Grupo 9º",
    "2856275": "4ª ANDALUZA ALEVIN (CADIZ) · Grupo 10º",
    "13252190": "4ª ANDALUZA INFANTIL (CADIZ) · Grupo 7º",
    "349917": "2ª ANDALUZA PREBENJAMIN (CADIZ) · Grupo 5º",
    "14747812": "TORNEO BEBE IFECA (CÁDIZ)",
    "33424766": "",   # no inscrito en 2026-27
    "2073084": "",    # no inscrito en 2026-27
    "28658193": "",   # no inscrito en 2026-27
}

MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
DIAS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
CAMPO_CASA = "Campo de Fútbol Picadueñas"
CAMPO_FUERA = "Visitante"


# ----------------------------------------------------------------------------- HTTP
def armar_sesion() -> requests.Session:
    """Sesión con warm-up: sin el home previo la RFAF devuelve 200 vacíos."""
    sesion = requests.Session()
    sesion.headers.update(HEADERS_UA)
    resp = sesion.get(URL_HOME, timeout=30, allow_redirects=True)
    resp.raise_for_status()
    time.sleep(PAUSA_ENTRE_PETICIONES_S)
    return sesion


def obtener_bytes(sesion: requests.Session, url: str, archivo: Path) -> bytes:
    """GET con reintentos y guardado del crudo de trabajo. Devuelve bytes."""
    archivo.parent.mkdir(parents=True, exist_ok=True)
    ultimo_ver: Optional[requests.Response] = None
    for intento in range(1, REINTENTOS + 1):
        try:
            resp = sesion.get(url, timeout=30, allow_redirects=True)
            resp.raise_for_status()
            if resp.content:
                archivo.write_bytes(resp.content)
                return resp.content
            # 200 vacío → throttling: se repite calentando
            sesion.get(URL_HOME, timeout=30, allow_redirects=True)
        except (requests.RequestException, ValueError) as err:
            ultimo_ver = err
        time.sleep(PAUSA_ENTRE_PETICIONES_S * intento)
    raise RuntimeError(f"No se pudo obtener {url} (último error: {ultimo_ver})")


def decodificar_iso8859_15(contenido: bytes) -> str:
    """Él único punto de decodificación de páginas de trabajo: ISO-8859-15."""
    return contenido.decode("iso-8859-15", errors="replace")


# ----------------------------------------------------------------------------- parser 2025-26
@dataclass
class FilaClasificacion:
    posicion: int
    equipo: str
    puntos: int
    pj: int
    pg: int
    pe: int
    pp: int
    codigo: str


def parsear_clasificacion(texto_html: str, club: str) -> list[FilaClasificacion]:
    """Extrae la tabla resumen (Pts/PJ · Pts · J G E P) de la clasificación.

    La RFAF sirve dos variantes de tabla: con columna "Pts/PJ" (los puntos en
    offset 4) y sin ella (los puntos en offset 3). Se detecta por los encabezados.
    """
    sopa = BeautifulSoup(texto_html, "html.parser")
    filas: list[FilaClasificacion] = []
    for tabla in sopa.find_all("table"):
        ths = [th.get_text(" ", strip=True) for th in tabla.find_all("th")]
        if "Partidos" not in ths:
            continue  # tabla resumen (cabecera con "Partidos")
        con_pts_pj = "Pts/PJ" in ths      # columna extra -> puntos en offset 4
        for tr in tabla.find_all("tr"):
            celdas = tr.find_all("td")
            if len(celdas) < 9:
                continue
            txt = [c.get_text(" ", strip=True) for c in celdas]
            if not txt[1].strip().isdigit():
                continue
            # Código del equipo desde el enlace del club (clave robusta)
            a = tr.find("a", href=True)
            codigo = ""
            m = re.search(r"[?&]codequipo=(\d+)", a["href"]) if a else None
            if m:
                codigo = m.group(1)
            base = 4 if con_pts_pj else 3   # índice de "Pts"
            try:
                fila = FilaClasificacion(
                    posicion=int(txt[1]),
                    equipo=txt[2],
                    puntos=int(txt[base]),
                    pj=int(txt[base + 1]),
                    pg=int(txt[base + 2]),
                    pe=int(txt[base + 3]),
                    pp=int(txt[base + 4]),
                    codigo=codigo,
                )
            except ValueError:
                continue
            if fila.puntos == 0 and fila.pj == 0 and "ICOVESA" in fila.equipo.upper():
                continue  # fila 2026-27 vacía no pertenece a la clasificación 2025-26
            filas.append(fila)
        if filas:
            break
    return filas


def fila_club(filas: list[FilaClasificacion], codigo_equipo: str) -> Optional[FilaClasificacion]:
    """Devuelve la fila del club (coincidencia por código de equipo del enlace)."""
    for fila in filas:
        if fila.codigo == codigo_equipo and fila.posicion:
            return fila
    # Fallback: prefijo del nombre (para filas sin enlace con código)
    prefijo = "A.D. ICOVESA"
    for fila in filas:
        if fila.equipo.upper().startswith(prefijo) and fila.posicion:
            return fila
    return None


# ----------------------------------------------------------------------------- parser 2026-27
@dataclass
class Partido:
    jornada: int
    fecha: str            # "Sáb 26 sep 2026"
    local: str
    visitante: str
    resultado: str
    campo: str
    rfaf_url: str


def extraer_partidos_jornada(
    texto_html: str, equipo_rfaf: str, comp: str, grupo: str, jornada: int
) -> Optional[Partido]:
    """Localiza el partido del club en una jornada y devuelve un Partido.

    Devuelve None si la jornada es un descanso (bye) del club o si aún no hay fecha.
    """
    sopa = BeautifulSoup(texto_html, "html.parser")
    for tr in sopa.find_all("tr"):
        # Obtener todos los nombres de equipos en h4 (con enlace)
        nombres_raw: list[str] = []
        for h4 in tr.find_all("h4"):
            a = h4.find("a")
            if a:
                nombres_raw.append(a.get_text(" ", strip=True))
            else:
                # Sin enlace = puede ser "Descansa" u otro texto
                txt = h4.get_text(" ", strip=True)
                if txt:
                    nombres_raw.append(txt)
        nombres: list[str] = [n for n in nombres_raw if n]
        if not nombres:
            continue

        es_club = [i for i, n in enumerate(nombres) if n.upper().startswith("A.D. ICOVESA")]
        if not es_club:
            continue

        # Detectar descanso (bye): el otro nombre contiene "Descansa" sin enlace
        tiene_descansa = any("DESCANSA" in n.upper() for n in nombres if not n.upper().startswith("A.D. ICOVESA"))
        if tiene_descansa:
            return None  # bye del club

        fecha_m = re.search(r"(\d{2})-(\d{2})-(\d{4})", tr.get_text(" ", strip=True))
        if not fecha_m:
            continue
        iso = f"{fecha_m.group(3)}-{fecha_m.group(2)}-{fecha_m.group(1)}"
        local = clean_team(nombres[0])
        visitante = clean_team(nombres[1]) if len(nombres) > 1 else "?"
        en_casa = es_club[0] == 0
        return Partido(
            jornada=jornada,
            fecha=iso,  # guardamos ISO para filtrado
            local=local,
            visitante=visitante,
            resultado="",
            campo=(CAMPO_CASA if en_casa else CAMPO_FUERA),
            rfaf_url=URL_CLASIFICACION.format(comp=comp, grupo=grupo),
        )
    return None


def clean_team(nombre: str) -> str:
    """Quita comillas simples decorativas del tipo A.D. ICOVESA 'A'."""
    return nombre.replace(" '", " ").replace("'", "").strip()


def fecha_es(iso: str) -> str:
    """Convierte 'YYYY-MM-DD' a 'Sáb 26 sep 2026'."""
    d = datetime.strptime(iso, "%Y-%m-%d")
    return f"{DIAS_ES[d.weekday()]} {d.day} {MESES_ES[d.month - 1]} {d.year}"


# ----------------------------------------------------------------------------- salidas
def construir_equipos(
    filas_por_equipo: dict[str, FilaClasificacion],
) -> list[dict[str, Any]]:
    categorias: dict[str, list[dict[str, Any]]] = {}
    orden: list[str] = []
    for eq in EQUIPOS_2025:
        categorias.setdefault(eq.categoria, [])
        if eq.categoria not in orden:
            orden.append(eq.categoria)
        fila = filas_por_equipo.get(eq.codigo_equipo)
        fede: dict[str, Any] = {
            "nombre": eq.nombre,
            "categoria_federada": eq.categoria_federada,
            "codigo_equipo": eq.codigo_equipo,
            "temporada": "2025-2026",
            "temporada_2026_27": REGISTRO_2026_27.get(eq.codigo_equipo, ""),
            "rfaf_url": URL_CLASIFICACION.format(comp=eq.competicion, grupo=eq.grupo),
        }
        if fila:
            fede["posicion_2025_2026"] = fila.posicion
            fede["puntos_2025_2026"] = fila.puntos
            fede["pj_2025_2026"] = fila.pj
            fede["pg_2025_2026"] = fila.pg
            fede["pe_2025_2026"] = fila.pe
            fede["pp_2025_2026"] = fila.pp
        else:
            fede["posicion_2025_2026"] = None
            fede["puntos_2025_2026"] = None
        categorias[eq.categoria].append(fede)

    nota_bebes = (
        "Escuela de iniciación que además compite federado (2ª ANDALUZA BEBE)."
        if filas_por_equipo.get("14747812")
        else "Escuela de iniciación, sin equipo federado."
    )
    cuerpo = []
    for categoria in orden:
        entrada: dict[str, Any] = {
            "categoria": categoria,
            "entrenador": "",
            "jugadores": [],
            "equipos_federados": categorias[categoria],
        }
        if categoria == "Bebés":
            entrada["nota"] = nota_bebes
        cuerpo.append(entrada)

    # Cadete y Juvenil se conservan (sin equipo federado actual).
    for extra in ("Cadete", "Juvenil"):
        if extra not in categorias:
            cuerpo.append({"categoria": extra, "entrenador": "", "jugadores": [], "equipos_federados": []})
    return cuerpo


# ----------------------------------------------------------------------------- main
def main() -> None:
    DIR_DAT.mkdir(parents=True, exist_ok=True)
    sesion = armar_sesion()

    # 1) Clasificaciones 2025-26 (usa fichero de trabajo si existe).
    filas_por_equipo: dict[str, FilaClasificacion] = {}
    print("== [1/3] Clasificaciones 2025-26")
    for eq in EQUIPOS_2025:
        archivo = DIR_DAT / f"clas_2025_{eq.codigo_equipo}.html"
        url = URL_CLASIFICACION.format(comp=eq.competicion, grupo=eq.grupo)
        if archivo.exists() and archivo.stat().st_size > 0:
            contenido = archivo.read_bytes()
        else:
            contenido = obtener_bytes(sesion, url, archivo)
        texto = decodificar_iso8859_15(contenido)
        filas = parsear_clasificacion(texto, eq.nombre)
        fila = fila_club(filas, eq.codigo_equipo)
        if fila:
            filas_por_equipo[eq.codigo_equipo] = fila
            print(f"   {eq.categoria:12s} {eq.nombre:16s} -> {fila.posicion}º · {fila.puntos} pts "
                  f"({fila.pj} j, {fila.pg}G {fila.pe}E {fila.pp}P)")
        else:
            print(f"   !! {eq.categoria:12s} {eq.nombre} -> NO encontrado en {url}")

    # 2) Próximos partidos 2026-27.
    print("== [2/3] Próximos partidos 2026-27")
    partidos: list[dict[str, Any]] = []
    for eq in EQUIPOS_2026:
        for jornada in JORNADAS_2026_A_EXTRAER:
            archivo = DIR_DAT / f"jor_2026_{eq.categoria}_{eq.equipo_rfaf}_{jornada}.html"
            url = URL_JORNADA.format(grupo=eq.grupo, comp=eq.competicion, jornada=jornada)
            if archivo.exists() and archivo.stat().st_size > 0:
                contenido = archivo.read_bytes()
            else:
                contenido = obtener_bytes(sesion, url, archivo)
            texto = decodificar_iso8859_15(contenido)
            partido = extraer_partidos_jornada(texto, eq.equipo_rfaf, eq.competicion, eq.grupo, jornada)
            if partido:
                # Solo incluir partidos a partir de hoy
                try:
                    fecha_partido = datetime.strptime(partido.fecha, "%Y-%m-%d").date()
                except ValueError:
                    fecha_partido = None
                if fecha_partido and fecha_partido < date.today():
                    print(f"   -- J{jornada} {eq.categoria:11s}: {partido.local} vs {partido.visitante} ({partido.fecha}) [pasado, omitido]")
                    continue
                partidos.append({
                    "fecha": partido.fecha,  # ISO (YYYY-MM-DD), se formatea al escribir
                    "categoria": eq.categoria,
                    "local": partido.local,
                    "visitante": partido.visitante,
                    "resultado": partido.resultado,
                    "campo": partido.campo,
                    "rfaf_url": partido.rfaf_url,
                })
                print(f"   J{jornada} {eq.categoria:11s}: {partido.local} vs {partido.visitante} · {fecha_es(partido.fecha)} ({partido.campo})")
            else:
                print(f"   !! J{jornada} {eq.categoria}: sin partido del club (jornada aún sin publicar)")

    # 3) Escritura UTF-8.
    print("== [3/3] Escritura JSON (UTF-8)")
    equipos = construir_equipos(filas_por_equipo)
    JSON_EQUIPOS.write_text(
        json.dumps({"equipos": equipos}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    partidos.sort(key=lambda p: p["fecha"])   # fecha es ISO (YYYY-MM-DD) durante el ordenado
    calendario = {
        "partidos": [
            {**p, "fecha": fecha_es(p["fecha"])} for p in partidos
        ]
    }
    JSON_CALENDARIO.write_text(
        json.dumps(calendario, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"   OK content/equipos.json    ({JSON_EQUIPOS.stat().st_size} bytes)")
    print(f"   OK content/calendario.json ({JSON_CALENDARIO.stat().st_size} bytes)")


if __name__ == "__main__":
    main()