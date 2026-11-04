# Use an official Python runtime as a parent image
FROM ubuntu:22.04

# Set environment variables to prevent interactive prompts during installation
ENV DEBIAN_FRONTEND=noninteractive

# these are given 
    #   GITHUB_REPOSITORY: ${{ github.repository }}
    #   GITHUB_RUN_ID: ${{ github.run_id }}
    #   GITHUB_RUN_NUMBER: ${{ github.run_number }}
    #   GITHUB_SHA: ${{ github.sha }}
# read env  GITHUB_REPOSITORY and add to container 
ENV GITHUB_REPOSITORY=${GITHUB_REPOSITORY}
ENV GITHUB_RUN_ID=${GITHUB_RUN_ID}
ENV GITHUB_RUN_NUMBER=${GITHUB_RUN_NUMBER}
ENV GITHUB_SHA=${GITHUB_SHA}


# Install system dependencies for MS ODBC Driver
# Adding apt-get clean and proper error handling
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        python3 \
        python3-pip \
        moreutils  && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add Microsoft GPG key and repository for ODBC driver (with proper error handling)
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-archive-keyring.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-archive-keyring.gpg] https://packages.microsoft.com/ubuntu/22.04/prod jammy main" > /etc/apt/sources.list.d/mssql-release.list


    RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        unixodbc \
        unixodbc-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install the MS ODBC driver and SQLCMD tools
RUN apt-get update && \
    ACCEPT_EULA=Y apt-get install -y --no-install-recommends \
        msodbcsql17 \
        mssql-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add SQLCMD to the path
ENV PATH="$PATH:/opt/mssql-tools/bin"

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-multipart \
    python-dotenv \
    pyodbc \
    requests \
    pydantic \
    sqlalchemy \
    PyCap \
    openpyxl \
    pandas \
    certifi \
    nh3 && \
    pip cache purge

# Set the working directory
WORKDIR /app

# Copy the rest of the application code
COPY . .

# Expose port 
EXPOSE 8080

# Command to run the app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
