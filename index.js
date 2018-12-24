/*
* @Author: liupishui
* @Date:   2018-02-07 19:46:55
* @Last Modified by:   liups
* @Last Modified time: 2018-12-24 10:41:56
*/
var fs = require('fs');
var path = require('path');
var PSD = require('psd');
const imageminPngquant = require('imagemin-pngquant');
const imageminJpegRecompress = require('imagemin-jpeg-recompress');
//var images = require("images");

// Load in our dependencies
var Pixelsmith = require('pixelsmithmix');

// Create a new engine
var pixelsmith = new Pixelsmith();

var getFiles=function(filePath){
    var files=[];
    var getFilesLoop=function(filePath){
        var filesCurrent=fs.readdirSync(filePath);
        for(let i=0;i<filesCurrent.length;i++){
            var fileStatCurrent={};
            fileStatCurrent.path=path.join(filePath,filesCurrent[i]);
            try{
                fileStatCurrent.stats=fs.statSync(fileStatCurrent.path);
                files.push(fileStatCurrent);
                if(fileStatCurrent.stats.isDirectory()){
                    if(fileStatCurrent.path.indexOf('.asar')!=(fileStatCurrent.path.length-5)){//.asar做为文件处理
                        getFilesLoop(fileStatCurrent.path);
                    }
                }
            }catch(e){
                //console.log(e)
            }
        }
    }
    getFilesLoop(filePath);
    return files;
}
function scanTree(psdfile,processing){
    var scanTreeOrg=function(Layer,processing){
        if (Layer.type == 'group' && Layer.visible) {
            for(let layerItem of Layer.children) {
                scanTreeOrg(layerItem,processing);
            }
        }
        if(Layer.type == 'layer' && Layer.visible){
            processing(Layer);
        };
    }
    var psd = PSD.fromFile(psdfile);
    if (psd.parse()) {
        var psdTreeExport = psd.tree().export();
        for(let layer of psdTreeExport.children) {
            scanTreeOrg(layer,processing);
        }
    }
}
function psd2pngmix(psdfile,cb,exportimgType){
    var psdfile=psdfile.path;
    if(psdfile.indexOf('.psd') == -1){
        cb()
        return;
    }
    var replaceLayers = [];
    var replaceLayersRecord = [];
    var linkLayersStyle = [];
    var linkLayersHtml = [];
    //console.log(psdfile);
    var linkCount = 0;
    var psd = PSD.fromFile(psdfile);
    if (psd.parse()) {
        scanTree(psdfile,function(Layer){
            if(Layer.name.indexOf('.psd') == Layer.name.length-4){
                replaceLayers.push(Layer);
                replaceLayersRecord.push(Layer);
            }
            if (Layer.name.indexOf('link:') == 0) {
                //按钮添加
                //link:href|className
                linkCount++;
                linkLayersStyle.push('.links' + linkCount + ' {width:'+Layer.width+'px;height:'+Layer.height+'px;margin-left:' + (Layer.left - psd.header.width / 2) + 'px;top:'+Layer.top+'px;}');
                if (Layer.name.indexOf('http://')!=-1||Layer.name.indexOf('https://')!=-1) {
                  linkLayersHtml.push('<a href="'+Layer.name.substr(5)+'" class="links links' + linkCount + ' ' + (Layer.name.split(':')[2].split('|')[1] ? Layer.name.split(':')[2].split('|')[1] : '') + '" target="_blank">' + Layer.name.split(':')[2].split('|')[0] + '</a>');
                }else{
                  linkLayersHtml.push('<a href="../' + path.dirname(Layer.name.split(':')[1].split('|')[0]) +'/'+ path.basename(Layer.name.split(':')[1].split('|')[0], '.psd') + '/index.html" class="links links' + linkCount + ' ' + (Layer.name.split(':')[1].split('|')[1] ? Layer.name.split(':')[1].split('|')[1] : '') + '">' + path.basename(Layer.name.split(':')[1].split('|')[0],'.psd') + '</a>');
                }
            }
        })
        var destPath = path.join(path.dirname(psdfile), path.basename(psdfile, '.psd') + '.png');
        psd.image.saveAsPng(destPath).then(function () {

            //递归替换对应图层
            var resolveReady = [];
            function replaceLayersToPng(layers, callback) {
                if (layers.length == 0) {
                    callback();
                } else {
                    var layersCurr = layers.splice(-1)[0];
                    var layersCurrPath = path.join(path.dirname(psdfile), layersCurr.name);
//                    console.log(layersCurrPath);
                    if (!resolveReady.some(function (val) { return val == layersCurrPath })) {
                        if (fs.existsSync(layersCurrPath)) {
                            var psdCurr = PSD.fromFile(layersCurrPath);
                            if(psdCurr.parse()){
                                //psdCurr.tree()._children[0].saveAsPng(path.join(path.dirname(layersCurrPath), path.basename(layersCurrPath, '.psd') + '3.png'));
                                psdCurr.image.saveAsPng(path.join(path.dirname(layersCurrPath), path.basename(layersCurrPath, '.psd') + '.png')).then(function () {
                                    replaceLayersToPng(layers, callback);
                                });
                            }else{
                                replaceLayersToPng(layers, callback);
                            }
                        } else {
                            replaceLayersToPng(layers, callback);
                        }
                    } else {
                        replaceLayersToPng(layers, callback);
                    }
                }
            }
            replaceLayersToPng(replaceLayers, function () {
               // var imageCurr = images(destPath);
                var imagesAll=[destPath];
                var imagesAllInfo=[destPath];
                for(let layer of replaceLayersRecord) {
                    var layersCurrPath = path.join(path.dirname(psdfile), layer.name);
                    var layersCurrPng = path.join(path.dirname(layersCurrPath), path.basename(layersCurrPath, '.psd') + '.png');
                    if (fs.existsSync(layersCurrPng)) {
                        //var imageWater = images(layersCurrPng);
                        var x = layer.left < 0 ? 0 : layer.left;
                        var y = layer.top < 0 ? 0 : layer.top;
                       // imageWater.resize(layer.width, layer.height);
                       // imageCurr.draw(imageWater, x, y);
                        imagesAll.push(layersCurrPng);
                        imagesAllInfo.push({path:layersCurrPng,x:x,y:y});
                    }
                };
                // console.log(imagesAll);
                // console.log(imagesAllInfo);
                    pixelsmith.createImages(imagesAll, function handleImages (err, imgs) {
                      // If there was an error, throw it
                      if (err) {
                        throw err;
                      }

                      // We recieve images in the same order they were given
                      imgs[0].width; // 50 (pixels)
                      imgs[0].height; // 100 (pixels)

                      // Create a canvas that fits our images (200px wide, 300px tall)
                      var canvas = pixelsmith.createCanvas(imgs[0].width, imgs[0].height);

                      // Add the images to our canvas (at x=0, y=0 and x=50, y=100 respectively)
                      canvas.addImage(imgs[0], 0, 0);
                      for(var i = 1; i<imagesAllInfo.length; i++){
                        canvas.addImage(imgs[i],imagesAllInfo[i].x,imagesAllInfo[i].y);
                      }
                      // Export canvas to image
                      var resultStream = canvas['export']({format: 'png'});
                      var writeStream = fs.createWriteStream(imagesAll[0]);
                      resultStream.pipe(writeStream);
                      //fs.writeFileSync(imagesAll[0],resultStream.data); // Readable stream outputting PNG image of the canvas
                    });

                    pixelsmith.createImages([destPath,destPath], function handleImages (err, imgs) {
                      // If there was an error, throw it
                      if (err) {
                        throw err;
                      }
                      // We recieve images in the same order they were given
                      imgs[0].width; // 50 (pixels)
                      imgs[0].height; // 100 (pixels)
                      var spriteLength = Math.floor(imgs[0].height/200);
                      var spriteNext = imgs[0].height%200;
                      var pathTarget = path.join(path.dirname(destPath),path.basename(destPath,'.png'));
                        if(!fs.existsSync(pathTarget)){
                            fs.mkdirSync(pathTarget);
                        }
                      var pathCurr = path.join(pathTarget,'images');
                        if(!fs.existsSync(pathCurr)){
                            fs.mkdirSync(pathCurr);
                        }
                      var htmlStrTop=['<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
                                       '<html xmlns="http://www.w3.org/1999/xhtml">',
                                       '<head>',
                                       '    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />',
                                       '    <meta name="renderer" content="webkit">',
                                       '<meta name="viewport" content="width=device-width,initial-scale=1.0, user-scalable=0, minimum-scale=1.0, maximum-scale=1.0">',
                                       '    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
                                       '    <title>' + path.basename(psdfile,'.psd') + '</title>',
                                       '    <meta name="keywords" content="关键字" />',
                                       '    <meta name="description" content="描述" />',
                                       '    <style type="text/css">',
                                       '        body{margin:0;}',
                                       '        .container_fetpsd2htmlmixBg{ position:relative;',
                                       '            min-width:1200px;',
                                       '            _width:expression(document.body.clientWidth < 1200 ? "1200" : "auto");',
                                       '        }',
                                        '    img{display:none;}',
                                        '     @media screen and ( max-width: 751px ){',
                                        '          .container_fetpsd2htmlmixBg{',
                                        '            min-width: 1%;',
                                        '          }',
                                        '          .fetpsd2htmlmixBg{',
                                        '            display:none;',
                                        '          }',
                                        '          img{',
                                        '            display:block;',
                                        '            max-width: 100%;',
                                        '             pointer-events: none;',
                                        '          }',
                                        '    }'];
                      htmlStrTop = [...htmlStrTop, ...linkLayersStyle];
                      var htmlStrCenter = ['    </style>',
                                           '</head>',
                                           '<body>',
                                           '    <div class="container_fetpsd2htmlmixBg">'];
                      //console.log(linkLayersHtml);
                      htmlStrCenter = [...htmlStrCenter, ...linkLayersHtml];
                      var htmlStrBottom = ['    </div>',
                                           '</body>',
                                           '</html>'];
                      var styleSheetsArr = ['    .fetpsd2htmlmixBg {height:200px; position:relative; background-position:center 0;background-repeat:no-repeat;}\r\n',
                      '.links{position:absolute;left:50%;display:block;z-index:92;overflow:hidden;text-indent:-999em;background:#fff;opacity:0;filter:alpha(opacity=0);}',
                      '.links:hover{opacity:.2;filter:alpha(opacity=20);}'
                      ];//样式拼凑
                      var divDomArr = [];//dom拼凑
                      for(let i = 0; i<spriteLength; i++){
                        let canvas = pixelsmith.createCanvas(imgs[0].width, 200);
                        canvas.addImage(imgs[0],0,-200*i);
                        let imgData = [];
                        let resultStream = canvas['export']({format:exportimgType == '.jpg' ?'jpg':'png'});
                        resultStream.on('data',function(chunk){
                          imgData.push(chunk);
                          //console.log(imgData);
                        });
                        resultStream.on('end',function(){
                          //console.log(Buffer.concat(imgData));
                          if(exportimgType == '.jpg'){
                                imageminJpegRecompress({max:85})(Buffer.concat(imgData)).then((rst) => {
                                    fs.writeFileSync(path.join(pathCurr,i+'.jpg'),rst);
                                },(err) =>{

                                })
                          }else{
                            imageminPngquant()(Buffer.concat(imgData)).then((rst)=>{
                                fs.writeFileSync(path.join(pathCurr,i+'.png'),rst);
                            },(err)=>{
                            })
                          }
                        })
                        styleSheetsArr.push('    .fetpsd2htmlmixBg'+i+' {background-image:url(images/'+i+exportimgType+');}\r\n');
                        divDomArr.push('      <div class="fetpsd2htmlmixBg fetpsd2htmlmixBg'+i+'"></div><img src="images/'+i+exportimgType+'"/>');
                      }
                      if(spriteNext){
                        let canvas = pixelsmith.createCanvas(imgs[0].width, spriteNext);
                        canvas.addImage(imgs[0],0,spriteNext-imgs[0].height);
                        let imgData = [];
                        let resultStream = canvas['export']({format:exportimgType == '.jpg' ?'jpg':'png'});
                        resultStream.on('data',function(chunk){
                          imgData.push(chunk);
                        });
                        resultStream.on('end',function(){
                          if(exportimgType == '.jpg'){
                            imageminJpegRecompress({max:85})(Buffer.concat(imgData)).then((rst) => {
                                fs.writeFileSync(path.join(pathCurr,spriteLength+'.jpg'),rst)
                            },(err) =>{
                            })
                          }else{
                            imageminPngquant()(Buffer.concat(imgData)).then((rst)=>{
                                fs.writeFileSync(path.join(pathCurr,spriteLength+'.png'),rst);
                            },(err)=>{
                            })
                          }
                        })

                        styleSheetsArr.push('    .fetpsd2htmlmixBg'+spriteLength+' {background-image:url(images/'+spriteLength+exportimgType+');height:'+spriteNext+'px;}\r\n');
                        divDomArr.push('      <div class="fetpsd2htmlmixBg fetpsd2htmlmixBg'+spriteLength+'"></div><img src="images/'+spriteLength+exportimgType+'"/>');
                      }
                      var htmlStrBottomScript = ['<script type="text/javascript">',
                                                 '  var resizeLinkPosition = function(){',
                                                 '  var baseWidth=parseInt(Math.min.apply(\'\',[window.screen.width,document.getElementsByTagName(\'body\')[0].offsetWidth]));',
                                                 '      if(baseWidth<751){',
                                                 '        var img = new Image();',
                                                 '        img.onload=function(){',
                                                 '          var rate =baseWidth/this.width;',
                                                 '          var links = document.querySelectorAll(\'.links\');',
                                                 '          for(var link in links){',
                                                 '            if(typeof(links[link])==\'object\'){',
                                                 '              var currStyle = getComputedStyle(links[link],null);',
                                                 '              var computedStyle = [',
                                                 '                \'width:\'+parseInt(currStyle[\'width\'])*rate+\'px\',',
                                                 '                \'height:\'+parseInt(currStyle[\'height\'])*rate+\'px\',',
                                                 '                \'margin-left:\'+parseInt(currStyle[\'margin-left\'])*rate+\'px\',',
                                                 '                \'top:\'+parseInt(currStyle[\'top\'])*rate+\'px\'',
                                                 '              ]',
                                                 '              links[link].style.cssText+=\';\'+computedStyle.join(\';\');',
                                                 '            };',
                                                 '          };',
                                                 '        }',
                                                 '        img.src=document.querySelector(\'img\').src+\'?t=\'+-new Date();',
                                                 '      }else{',
                                                 '          var links = document.querySelectorAll(\'.links\');',
                                                 '          for(var link in links){',
                                                 '            if(typeof(links[link])==\'object\'){',
                                                 '               links[link].style.cssText=\' \';',
                                                 '            };',
                                                 '          };',
                                                 '      }',
                                                 '  }',
                                                 '  resizeLinkPosition();',
                                                 '  window.onresize=function(){',
                                                 '    resizeLinkPosition();',
                                                 '  }',
                                                 '</script>'];
                      var htmlMixAll = htmlStrTop.concat(styleSheetsArr,htmlStrCenter,divDomArr,htmlStrBottom,htmlStrBottomScript).join('\r\n');
                      fs.writeFileSync(path.join(pathTarget,'index.html'),htmlMixAll);
                    });
                cb(imagesAll[0]);
            });
        });
    };
}
function psd2pngmixauto(path,cbauto,exportimgType){
    var allFile=[];
    if(fs.existsSync(path)){
        var pathInfo=fs.statSync(path);
        if(pathInfo.isDirectory()){
            allFile = getFiles(path);
        }else{
            allFile.push({path:path});
        }
        var parseAllFile=function(arr,cbauto,exportimgType){
            if(arr.length==0){
                cbauto();
            }else{
                var fileCurr=arr.splice(-1)[0];
                psd2pngmix(fileCurr,function(filename){cbauto(filename);parseAllFile(arr,cbauto)},exportimgType);
            }
        }
        parseAllFile(allFile,cbauto,exportimgType);
    }else{
        cbauto();
        console.log('没有该文件');
    }
};
module.exports = {scanTree:scanTree,psd2htmlmix:psd2pngmix,psd2htmlmixauto:psd2pngmixauto}
