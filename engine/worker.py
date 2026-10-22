import sys,json,traceback
from core import Engine,EngineError
engine=Engine()
allowed={'open','info','close','render','objects','text_backdrop','text_layout','ocr_plan','ocr_begin','ocr_step','ocr_finish','ocr_cancel','image_layer','search','preview','commit','history','plan','replace_plan','conversion_info','markup_plan','markups','export','import_file'}
for line in sys.stdin:
    try:
        request=json.loads(line)
        if request['method'] not in allowed:raise EngineError('invalidOperation')
        result=getattr(engine,request['method'])(**request.get('params',{}))
        response={'id':request['id'],'result':result}
    except EngineError as e:response={'id':request.get('id'),'error':{'code':e.code,'details':e.details}}
    except Exception:
        traceback.print_exc(file=sys.stderr);response={'id':request.get('id'),'error':{'code':'operationFailed'}}
    print(json.dumps(response,ensure_ascii=False),flush=True)
