def test_upload_roundtrip(client, data_dir):
    content = b"id,name\n1,foo\n"
    uploaded = client.post(
        "/api/files", files={"file": ("data.csv", content)}
    ).json()
    assert uploaded["filename"] == "data.csv"
    assert uploaded["size"] == len(content)
    assert uploaded["id"]
    assert (data_dir / "uploads" / uploaded["id"]).read_bytes() == content


def test_upload_sanitizes_filename(client):
    uploaded = client.post(
        "/api/files", files={"file": ("../../evil.csv", b"x")}
    ).json()
    assert uploaded["filename"] == "evil.csv"


def test_upload_rejects_oversize(client, monkeypatch):
    import app.routers.files as files_module

    monkeypatch.setattr(files_module, "MAX_FILE_SIZE", 4)
    response = client.post("/api/files", files={"file": ("a.csv", b"12345")})
    assert response.status_code == 413
