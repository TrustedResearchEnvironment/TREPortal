



# Helper function to calculate paged results
def get_paged_result(items, page, page_size):
    start = (page - 1) * page_size
    end = start + page_size
    total_count = len(items)
    total_pages = (total_count + page_size - 1) // page_size
    print("start:", start, "end:", end, "total_count:", total_count, "total_pages:", total_pages)
    return {
        "CurrentPage": page,
        "PageCount": total_pages,
        "PageSize": page_size,
        "RowCount": total_count,
        "FirstRowOnPage": start + 1 if total_count > 0 else 0,
        "LastRowOnPage": min(end, total_count ),
        "Results": items[start:end]
    }
