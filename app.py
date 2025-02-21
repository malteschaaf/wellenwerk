import pandas as pd
import requests
import streamlit as st

API_URL = (
    "https://yjeobizxiwkzczfpuyit.supabase.co/functions/v1/past-sessions-availability"
)


def fetch_data(from_date, to_date):
    params = {"from": from_date, "to": to_date}
    response = requests.get(API_URL, params=params)
    if response.status_code == 200:
        return response.json()
    else:
        st.error(f"Fehler beim Abrufen der Daten: {response.text}")
        return []


st.title("Verfügbarkeit vergangener Sitzungen")

# Datumsfilter in Streamlit
from_date = st.date_input("Von", pd.Timestamp.today() - pd.Timedelta(days=7))
to_date = st.date_input("Bis", pd.Timestamp.today())

# Daten abrufen
data = fetch_data(str(from_date), str(to_date))

# DataFrame anzeigen
if data:
    df = pd.DataFrame(data)
    st.dataframe(df)
else:
    st.write("Keine Daten für den gewählten Zeitraum gefunden.")
