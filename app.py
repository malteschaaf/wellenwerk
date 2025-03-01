import pandas as pd
import requests
import streamlit as st
from streamlit_calendar import calendar

# API Endpoint for fetching session data
API_URL = (
    "https://yjeobizxiwkzczfpuyit.supabase.co/functions/v1/past-sessions-availability"
)

# Streamlit Page Configuration
st.set_page_config(page_title="Wellenwerk Buchungskalender", page_icon="🌊")
st.title("Wellenwerk Kalender")

# Define colors for different session types
SESSION_COLORS = {
    "Intermediate Surf Session": "#FFBD45",
    "Trainingssession (Advanced/Pro)": "#FF6C6C",
    "Surfnight": "#4B7BEC",
}

# Initialize start and end dates in session state
if "start_date" not in st.session_state:
    today = pd.Timestamp.today()
    # Align the start date with the beginning of the current week (Monday)
    st.session_state["start_date"] = today - pd.Timedelta(days=today.dayofweek)
st.session_state["end_date"] = st.session_state["start_date"] + pd.Timedelta(days=7)


# Function to fetch data from the API, using caching for performance
@st.cache_data
def fetch_data(start_date, end_date):
    """
    Fetch session data from the API within the given date range.
    The response is cached to minimize API calls.
    """
    params = {"start": str(start_date.date()), "end": str(end_date.date())}
    response = requests.get(API_URL, params=params)

    if response.status_code == 200:
        return response.json()
    else:
        st.error(f"Fehler beim Abrufen der Daten: {response.text}")
        return []


# Function to convert session data into calendar event format
def prepare_events(data):
    """
    Transforms session data into the required format for the calendar component.
    """
    events = []
    for row in data:

        suffix = ""
        if pd.Timestamp(row["start_time"]) < pd.Timestamp.now().tz_localize("UTC"):
            suffix = "| ✅"

        events.append(
            {
                "title": f"{row['session_type']} | Availability: {row['last_availability']} {suffix}",
                "color": SESSION_COLORS.get(row["session_type"], "gray"),
                "start": pd.to_datetime(row["start_time"])
                .tz_convert("UTC")
                .isoformat(),
                "end": pd.to_datetime(row["end_time"]).tz_convert("UTC").isoformat(),
                "extendedProps": {"availability": row["last_availability"]},
            }
        )
    return events


# Configure the calendar options
calendar_options = {
    "initialDate": str(st.session_state["start_date"].date()),
    "initialView": "listWeek",
    "firstDay": 1,  # Monday as first day of the week
    "headerToolbar": {
        "left": "title",
        "center": "",
        "right": "",
    },
}

# Fetch session data and format it for the calendar
data = fetch_data(st.session_state["start_date"], st.session_state["end_date"])
events = prepare_events(data)

# Display the calendar
state = calendar(events=events, options=calendar_options)

# Layout for navigation buttons
col1, col2 = st.columns([1, 3.75])

# Determine if navigation buttons should be disabled
disable_previous = st.session_state[
    "start_date"
].date() == pd.Timestamp.today().date() - pd.Timedelta(
    days=pd.Timestamp.today().dayofweek
) - pd.Timedelta(
    weeks=3
)
disable_next = st.session_state[
    "start_date"
].date() == pd.Timestamp.today().date() - pd.Timedelta(
    days=pd.Timestamp.today().dayofweek
) + pd.Timedelta(
    weeks=1
)

# Button to navigate to the previous week
with col1:
    if st.button("Vorherige Woche", disabled=disable_previous):
        st.session_state["start_date"] -= pd.Timedelta(weeks=1)
        st.session_state["end_date"] = st.session_state["start_date"] + pd.Timedelta(
            days=7
        )
        st.rerun()

# Button to navigate to the next week
with col2:
    if st.button("Nächste Woche", disabled=disable_next):
        st.session_state["start_date"] += pd.Timedelta(weeks=1)
        st.session_state["end_date"] = st.session_state["start_date"] + pd.Timedelta(
            days=7
        )
        st.rerun()
