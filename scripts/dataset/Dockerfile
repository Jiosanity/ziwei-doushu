FROM python:3.12-alpine
RUN pip install --no-cache-dir zstandard==0.25.0
WORKDIR /importer
COPY import.py ./
ENTRYPOINT ["python", "-u", "import.py"]
